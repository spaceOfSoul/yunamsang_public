from flask import Flask, render_template, request, redirect, url_for, session, abort
from flask_socketio import SocketIO, join_room, leave_room, emit
from flask_wtf.csrf import CSRFProtect
from pymongo import MongoClient
import win32com.client

import requests
import json

from dotenv import load_dotenv
import os

import secrets
from Crypto.Hash import SHA256
import re

#.env 환경변수 파일 로드
load_dotenv()

#앱 초기화
app = Flask(__name__)
#config
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY')
app.config['DEBUG'] = False

#크로스사이트 위조 요청 대비 csrf 토큰 인증
csrf = CSRFProtect(app)
csrf.init_app(app)

#소켓 초기화
socketio = SocketIO(app)

#방 정보
_users_in_room = {} # 방별 유저 목록
_room_of_sid = {} # stores room joined by an used
_name_of_sid = {} # stores display name of users
_emotion_in_room = {}

#졸고 있는 사람의 목록
_sleep_in_room = {}

#몽고DB 클라이언트
mongo_client = MongoClient(os.environ.get('DB_URL'))

# 카카오톡 전송
with open("kakao_token.json","r") as fp:
    tokens = json.load(fp)


url="https://kapi.kakao.com/v2/api/talk/memo/default/send"

headers={
    "Authorization" : "Bearer " + tokens["access_token"]
}

#=========================================================================================
#기타 함수

# 비밀번호
def pw_rule(pw):
    # 2종 이상 문자로 구성된 8자리 이상 비밀번호
    PT1 = re.compile('^(?=.*[A-Z])(?=.*[a-z])[A-Za-z\d!@#$%^&*]{8,}$')
    PT2 = re.compile('^(?=.*[A-Z])(?=.*\d)[A-Za-z\d$@$!%*?&]{8,}$')
    PT3 = re.compile('^(?=.*[A-Z])(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$')
    PT4 = re.compile('^(?=.*[a-z])(?=.*\d)[A-Za-z\d!@#$%^&*]{8,}$')
    PT5 = re.compile('^(?=.*[a-z])(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$')
    PT6 = re.compile('^(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$')
    # 문자 구성 상관없이 10자리 이상 비밀번호 검사 정규식
    PT7 = re.compile('^[A-Za-z\d!@#$%^&*]{10,}$')
    
    #위의 정규식 중 하나라도 만족하면 비번 생성
    for pattern in [PT1, PT2, PT3, PT4, PT5, PT6, PT7]:
        if pattern.match(pw):
            return True
    #정규식을 모두 만족하지 못할시 비번 규칙에 어긋나므로
    return False


#=========================================================================================
#route

# 홈화면
@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST": # 홈화면에서 폼 제출시 (방 이름 제출)
        room_id = request.form['room_id']
        return redirect(url_for("entry_checkpoint", room_id=room_id))
    
    # user가 id 세션을 가지고 있는지 확인
    user = session.get('_id')
    # 만약 가지고 있다면 (로그인이 되어 있다면)
    isLogined = False
    user_name = None
    if user is not None:
        isLogined = True
        user_name = session['_id']['nickname']
        
    return render_template("home.html", isLogined = isLogined, user_name = user_name) # 홈화면 렌더링

#로그인
@app.route('/login', methods = ["GET", "POST"])
def login():
    if request.method == "POST":
        id = request.form.get('id')
        pw = request.form.get('pw')
        
        #mongodb 클라이언트
        member = mongo_client.onlineClass.member
        
        # state = 0 : None
        # state = 1 : 아이디 공란
        # state = 2 : 비번 공란
        # state = 3 : 아이디 비번 불일치
        # state = 4 : 로그인 실패 10번
        # state = 5 : 이미 다른 브라우저에서 로그인함
        
        if id == "":#아이디 공란
            return render_template("login.html",state = 1)
        if pw == "":#비번 공란
            return render_template("login.html",state = 2)
        
        if member.count_documents({"id" : id}): # 아이디 일치
            x=member.find_one({'id':id})
            
            if x['loginFailedCount'] >= 10: # 로그인 실패횟수가 10번을 넘어갈 시
                return render_template("login.html",state = 4)
            
            salt = x['salt']
            hash_obj = SHA256.new()
            hash_obj.update(bytes(pw + salt, 'utf-8'))
            h =hash_obj.hexdigest()
            if x['password'] == h: # 비밀번호가 일치할 시
                
                # 이미 로그인이 되어 있다면
                if x['isLogined'] != 0:
                    return render_template('login.html',state=5)
                
                session['_id'] = {"id" :id, "nickname" : x['name'], 'authentication' : 0}
                member.update_one({'id':id},{"$set":{'loginFailedCount':0, 'isLogined':1}})
                return redirect(url_for('index'))
            else: # 비밀번호가 일치하지 않을 시
                x['loginFailedCount'] += 1 #유저 데이터의 로그인 실패횟수 증가
                member.update_one({'id':id},{"$set":{'loginFailedCount':x['loginFailedCount']}})
        #아이디 혹은 비번 불일치
        return render_template("login.html",state = 3)
    #로그인 화면 렌더링
    return render_template('login.html',state=0)

#로그아웃
@app.route('/logout')
def logout():
    try:
        member = mongo_client.onlineClass.member
        member.update_one({'id':session['_id']['id']},{"$set":{'isLogined':0}})
    except:
        abort(503)
    session.clear() # 세션 클리어 후
    return redirect(url_for('index')) # 홈화면 리다이렉트

# 회원가입
@app.route('/signup', methods= ["GET","POST"])
def signup_page():
    if request.method == "POST":
        try:
            id = request.form.get('id')
            pw = request.form.get('pw')
            pw_check = request.form.get('pwCheck')
            nicname = request.form.get('nickname')
            email = request.form.get('email')
        except:
            abort(400)
        member = mongo_client.onlineClass.member
        
        # state == 1 : id 공란
        # state == 2 : id가 이미 존재함
        # state == 3 : 패스워드가 서로 맞지 않음
        # state == 4 : 패스워드 규칙에 어긋남.
        # state == 5 : email칸이 공란
        
        if id == "": # 아이디가 공란일때
            return render_template("signup.html",state = 1)
        if member.count_documents({"id" : id}):#아이디가 이미 있을때
            return render_template("signup.html",state=2)
        
        if email == "":
            return render_template("signup.html",state = 5)
            
        if pw != pw_check:
            return render_template("signup.html",state=3)
        
        # 비밀번호 규칙을 만족하지 못했을 경우
        if pw_rule(pw) == False:
            return render_template("signup.html",state=4)
        
        hash_obj = SHA256.new()
        salt=secrets.token_hex(32)
        hash_obj.update(bytes(pw + salt, 'utf-8'))
        h =hash_obj.hexdigest()
        
        #db에 저장할 회원 데이터
        data = {
            'name': nicname,
            'id' :id,
            'email' : email,
            'belong' : '',
            'password' : h,
            'loginFailedCount':0,
            'salt' : salt,
            'isLogined' : 0
        }
        mongo_client.onlineClass.member.insert_one(data)
        return redirect(url_for('login'))
    #회원가입 화면 렌더링
    return render_template("signup.html", state = 0)

@app.route("/room/<string:room_id>/", methods = ['GET', 'POST'])
def enter_room(room_id):
    if room_id not in session:# 방에 속해 있는지
        #방에 없다면 entry check포인트로 리다이렉트
        return redirect(url_for("entry_checkpoint", room_id=room_id))
    
    # 카톡 메시지 전송("현장미션")
    send_txt = session['_id']['nickname'] + '님이' + room_id + '에 입장했습니다.'
    
    send_data={
    "template_object": json.dumps({
        "object_type":"text",
        "text":send_txt ,
        "link":{}
    })
    }

    response = requests.post(url, headers=headers, data=send_data)
    print(response)
    
    #방에 있으면 수업 화면으로
    return render_template("chatroom.html", room_id=room_id, display_name=session[room_id]["name"], mute_audio=session[room_id]["mute_audio"], mute_video=session[room_id]["mute_video"])

@app.route("/room/<string:room_id>/checkpoint/", methods=["GET", "POST"])
def entry_checkpoint(room_id):
    if request.method == "POST":
        display_name = request.form['display_name']
        mute_audio = request.form['mute_audio']
        mute_video = request.form['mute_video']
        # 방아이디로 생성된 세션에 디스플레이 정보(화면 표시 여부, 오디오 여부 등) 저장
        # (방 생성)
        session[room_id] = {"name": display_name, "mute_audio":mute_audio, "mute_video":mute_video,
                            "emotion" : 'neutral', 'sleep_people' : {}}
        # 이 생성된 채로 enter_room 리다이렉트
        return redirect(url_for("enter_room", room_id=room_id))

    #채팅 준비 화면(chatroom_checkpoint) 렌더링
    try :
        return render_template("chatroom_checkpoint.html", room_id=room_id, naming = session["_id"]["nickname"])
    except :
        abort(403)

# 프로필 페이지
@app.route('/profile', methods = ['GET','POST'])
def profile_page():
    # POST
    if request.method == 'POST':
        _id = request.form.get('id')
        _name = request.form.get('nickname')
        pw = request.form.get('pw')
        pw_check = request.form.get('pwCheck')
        
        member = mongo_client.onlineClass.member
        
        # state => 1 : 이미 해당 아이디를 사용중일때
        # state => 2 : 변경하려는 id가 이미 있을 때
        # state => 3 : 변경할 비번이 일치하지 않을 때
        # state => 4 : 비번이 규칙에 어긋날 때
        
        # 업데이트 쿼리
        updateQuery = {}
        
        # 탬플릿 렌더링시 넘길 값
        name = session['_id']['nickname']
        user_id = session['_id']['id']
        
        # id 수정
        if _id != '':
            if _id == session['_id']['id']: # 이미 해당 아이디를 사용중일때
                return render_template("profile.html",state=1,name = name, user_id = user_id)
            if member.count_documents({"id" : _id}): # 아이디가 이미 있을때
                return render_template("profile.html",state=2,name = name, user_id = user_id)
            updateQuery['id'] = _id
        
        if _name != '':
            updateQuery['name'] = _name
        #비밀번호 수정
        if pw != '':
            if pw != pw_check: # 비번 확인란과 변경 비번이 일치하지 않을 시
                return render_template("profile.html",state=3,name = name, user_id = user_id)
            if pw_rule(pw) == False: # 변경할 비번이 비번 규칙에 맞지 않을 시
                return render_template("profile.html",state=4,name = name, user_id = user_id)
            
            x=member.find_one({'id':user_id})
            salt = x['salt']
            hash_obj = SHA256.new()
            hash_obj.update(bytes(pw + salt, 'utf-8'))
            h =hash_obj.hexdigest()
            updateQuery['password'] = h
            
        
        print(updateQuery)
        member.update_one({'id':session['_id']['id']},{"$set":updateQuery})
        
        # 아이디를 변경했을 시 세션데이터도 같이 변경
        if updateQuery.get('id') is not None:
            session['_id']['id'] = updateQuery['id']
            session.modified = True
            
        # 이름을 변경했을 시 ``
        if updateQuery.get('name') is not None:
            session['_id']['nickname'] = updateQuery['name']
            session.modified = True
            
        # 탬플릿 렌더링시 넘길 값
        name = session['_id']['nickname']
        user_id = session['_id']['id']
            
        return render_template("profile.html",state=0,name = name, user_id = user_id)
    
    # 여기부터 GET
    user = session.get('_id')
    
    if user is not None: # 로그인이 되어있을 시
        if session['_id']['authentication'] == 0: # 비번 인증을 한번 더 거칩니다
            return redirect(url_for('pw_authentication'))
        
        session['_id']['authentication'] = 0
        session.modified = True
        user_id = user['id']
        x = mongo_client.onlineClass.member.find_one({'id':user_id})
        name = x['name']
        
        return render_template('profile.html',name = name, user_id = user_id)
    # 로그인이 되어있지 않을 시
    return redirect(url_for('login'))

# 비밀번호 재인증(for profile)
# 프로필 페이지에서 리다이렉트 하는 것 말고는 접근하지 못해야 함.
@app.route('/password-authentication', methods = ['GET','POST'])
def pw_authentication():
    if session.get('_id') is None: # url로 억지로 접근한 경우
        abort(403)
    if request.method == 'POST':
        user_id = session['_id']['id']
        pw = request.form.get('pw')
        
        member = mongo_client.onlineClass.member
        x = member.find_one({'id':user_id})
        
        #입력된 비번 해시화
        salt = x['salt']
        hash_obj = SHA256.new()
        hash_obj.update(bytes(pw + salt, 'utf-8'))
        h =hash_obj.hexdigest()
        
        if x['password'] == h: # 비밀번호가 일치할 시
            # 인증을 True로 변경
            session['_id']['authentication'] = 1
            session.modified = True
            return redirect(url_for('profile_page'))
        else:
            return render_template('pw_authentication.html', state = 1)
        
    return render_template('pw_authentication.html', state = 0)

@app.route('/email', methods = ['POST'])
def capture():
    data = request.form.get('imgSrc')
    
    if data != None :
        member = mongo_client.onlineClass.member
        
        x=member.find_one({'id':session['_id']['id']})
        
        image_for_body = f'<img src="data:image/png;base64,{data}"/>'
        
        outlook = win32com.client.Dispatch("Outlook.Application")
        send_mail = outlook.CreateItem(0)

        send_mail.To = x['email'] #메일 수신인
        send_mail.Subject = "유남생 발신" #메일 제목
        send_mail.HTMLBody = image_for_body #메일 내용(html)
        send_mail.Send()
       
#=========================================================================================
# Error pages
# 400
@app.errorhandler(400)
def error_400(err):
    return render_template('/error/error400.html')

# 403
@app.errorhandler(403)
def error_403(err):
    return render_template('/error/error403.html')

#404
@app.errorhandler(404)
def error_404(err):
    return render_template('/error/error404.html')

#500
@app.errorhandler(500)
def error_500(err):
    return render_template('/error/error500.html')

#503
@app.errorhandler(503)
def error_503(err):
    return render_template('/error/error503.html')

#=========================================================================================
#Socket IO
@socketio.on("connect")
def on_connect():
    sid = request.sid
    print("New socket connected ", sid)
    

@socketio.on("join-room")
def on_join_room(data):
    sid = request.sid
    room_id = data["room_id"]
    display_name = session[room_id]["name"]
    
    # register sid to the room
    join_room(room_id)
    _room_of_sid[sid] = room_id
    _name_of_sid[sid] = display_name
    
    # broadcast to others in the room
    print("[{}] New member joined: {}<{}>".format(room_id, display_name, sid))
    emit("user-connect", {"sid": sid, "name": display_name}, broadcast=True, include_self=False, room=room_id)
    
    # add to user list maintained on server
    if room_id not in _users_in_room:
        _users_in_room[room_id] = [sid]
        emit("user-list", {"my_id": sid}) # send own id only
        #표정 정보 초기화
        _emotion_in_room[room_id] = {'angry':0, 'disgusted':0, 'feearful':0, 'happy':0, 'neutral':1, 'sad':0, 'surprised':0}
        _sleep_in_room[room_id] = {}
    else:
        usrlist = {u_id:_name_of_sid[u_id] for u_id in _users_in_room[room_id]}
        emit("user-list", {"list": usrlist, "my_id": sid}) # send list of existing users to the new member
        _users_in_room[room_id].append(sid) # add new member to user list maintained on server
        #표정짓는 인원 증가(nuetral 한명 추가)
        _emotion_in_room[room_id]['neutral'] += 1

    print("\nusers: ", _users_in_room, "\n")


@socketio.on("disconnect")
def on_disconnect():
    sid = request.sid
    room_id = _room_of_sid[sid]
    display_name = _name_of_sid[sid]

    print("[{}] Member left: {}<{}>".format(room_id, display_name, sid))
    emit("user-disconnect", {"sid": sid}, broadcast=True, include_self=False, room=room_id)

    _users_in_room[room_id].remove(sid)
    if len(_users_in_room[room_id]) == 0:
        _users_in_room.pop(room_id)
        _emotion_in_room.pop(room_id)
    else:
        _emotion_in_room[room_id][session[room_id]['emotion']]-=1
    _room_of_sid.pop(sid)
    _name_of_sid.pop(sid)
    

    print("\nusers: ", _users_in_room, "\n")

@socketio.on("data")
def on_data(data):
    sender_sid = data['sender_id']
    target_sid = data['target_id']
    if sender_sid != request.sid:
        print("[Not supposed to happen!] request.sid and sender_id don't match!!!")

    if data["type"] != "new-ice-candidate":
        print('{} message from {} to {}'.format(data["type"], sender_sid, target_sid))
    socketio.emit('data', data, room=target_sid)

#text chatting
@socketio.on("chat")
def chat(message): 
    if message != '':
        sid = request.sid
        room_id =_room_of_sid[sid]
        data = {'message' : message, 'sender' : _name_of_sid[sid], 'sid' : sid}
        emit('chat',data,room = room_id)

#user state
@socketio.on('face')
def get_emote(face_data): # face_data => 표정 정보, 눈감음 정보
    sid = request.sid
    try:
        roomname = _room_of_sid[sid]
    except KeyError:
        return redirect(url_for('index'))
    # 표정 정보가 존재하지 않을시
    if face_data.get('emote') is None or face_data.get('eye') is None:
        return
    
    #기존의 표정과 다를시
    if face_data['emote'] != session[roomname]['emotion']:
        _emotion_in_room[roomname][face_data['emote']] += 1 # 표정 짓는 인원의 수를 갱신
        _emotion_in_room[roomname][session[roomname]['emotion']] -= 1
        session[roomname]['emotion'] = face_data['emote']
        session.modified = True
    
    #표정 데이터
    emo_data = {'emo':_emotion_in_room[roomname],'emotion' : session[roomname]['emotion'], 'sid' : sid}
    
    # 자는 사람의 데이터
    sleep_data={ 'name' : _name_of_sid[sid], 'sid' : sid, 'isSleep' : face_data['eye']}
    
    # 전송할 데이터
    data = {'emo' : emo_data, 'sleep_data': sleep_data, 'total_number' : len(_users_in_room[roomname])}
    
    socketio.emit('face',data,room = roomname)
    

#====================================================
# =====================================
#main
if __name__ == '__main__':
    socketio.run(app)
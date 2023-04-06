const total_description_area = document.getElementById('emotion_description');
const total_description_emoticon = document.getElementById('emotion_emoticon');

const description_neg_emote = document.getElementById('negat');
const description_pos_emote = document.getElementById('posit');
const description_nor_emote = document.getElementById('middle');

description_neg_emote.style = "color : red; display:inline";
description_pos_emote.style = "color : blue; display:inline";
description_nor_emote.style = "color : black; display:inline";

total_description_area.style = "display:inline";

var totalEmote = {
    'emo': { 'angry': 0, 'disgusted': 0, 'feearful': 0, 'happy': 0, 'neutral': 0, 'sad': 0, 'surprised': 0 }
};
let total_number = 0;
var totalSleep = { 'sleep': [], 'noSleep': [] };

socket.on("face", (data) => {
    totalEmote = { 'emo': data['emo']['emo'] };
    total_number = data['total_number'];

    const student = document.getElementById("div_" + data['sleep_data']['sid']);

    if (student != null) {
        const txt = student.querySelector('.display-name');
        if (txt != null) {
            if (data['sleep_data']['isSleep'] == 1) {
                txt.innerText = data['sleep_data']['name'] + ' 🚨';
            } else {
                txt.innerText = data['sleep_data']['name'] + ' 🟢';
            }
        }
    }
});

setInterval(async() => {
    let descriptionText = '';
    let descriptionEmoticopn = '';

    let negative_txt = '';
    let positive_txt = '';
    let middle_txt = '';

    let angryEmote = 0;
    let happyEmote = 0;
    let sadEmote = 0;
    let neutralEmote = 0;

    for (let i = 0; i < 7; i++) {
        if (totalEmote['emo'][emotions[i]] > 0) {
            if (emotions[i] == 'angry' || emotions[i] == 'fearful') { // 부정
                angryEmote += totalEmote['emo'][emotions[i]];
                negative_txt += (defineEmote[emotions[i]] + ` ${totalEmote['emo'][emotions[i]]}명 `);
            } else if (emotions[i] == 'happy' || emotions[i] == 'surprised') { // 긍정
                happyEmote += totalEmote['emo'][emotions[i]];
                positive_txt += (defineEmote[emotions[i]] + ` ${totalEmote['emo'][emotions[i]]}명 `);
            } else if (emotions[i] == 'sad' || emotions[i] == 'disgusted') { // 헷갈림(부정)
                sadEmote += totalEmote['emo'][emotions[i]];
                negative_txt += (defineEmote[emotions[i]] + ` ${totalEmote['emo'][emotions[i]]}명 `);
            } else if (emotions[i] == 'neutral') { // 자연스러움
                neutralEmote += totalEmote['emo'][emotions[i]];
                middle_txt += (defineEmote[emotions[i]] + ` ${totalEmote['emo'][emotions[i]]}명 `);
            }
        }
    }

    descriptionText += `/전체 인원 ${total_number}명`;

    if (angryEmote / total_number >= 0.5) {
        descriptionText += '<br> 학생들이 지치고 힘들어보여요. 분위기 전환이 조금 필요할 것 같아요.';
        descriptionEmoticopn += '😴';
    } else if (happyEmote / total_number >= 0.5) {
        descriptionText += '<br> 수업의 분위기가 좋아 보입니다!';
        descriptionEmoticopn += '😃';
    } else if (sadEmote / total_number >= 0.5) {
        descriptionText += '<br> 학생들의 이해도가 떨어지는 것 같아요. 적절한 예시를 들어보는 건 어떨까요?';
        descriptionEmoticopn += '😵';
    } else if (neutralEmote / total_number >= 0.5) {
        descriptionText += '<br> 수업이 원활하게 잘 되는 것 같아요!';
        descriptionEmoticopn += '😏';
    }

    descriptionText = descriptionText.replace(/(<br>|<br\/>|<br \/>)/g, '\r\n');
    descriptionEmoticopn = descriptionEmoticopn.replace(/(<br>|<br\/>|<br \/>)/g, '\r\n');

    description_neg_emote.innerText = negative_txt;
    description_pos_emote.innerText = positive_txt;
    description_nor_emote.innerText = middle_txt;

    total_description_area.innerText = descriptionText;
    total_description_emoticon.innerText = descriptionEmoticopn;
    //졸거나 자고있는 사람 판별하여 표시
}, 3000);
const video = document.getElementById('local_vid')

const emotions = ['angry', 'disgusted', 'feearful', 'happy', 'neutral', 'sad', 'surprised'];
const defineEmote = {
    'angry': '화남',
    'disgusted': '역겨움',
    'feearful': '겁 먹음',
    'happy': '행복',
    'neutral': '평시',
    'sad': '슬픔',
    'surprised': '놀람'
};

var emotion = "neutral"; //표정 기본값

let closeEye = 0;
let irisC = [];

// Load the models from the Models folder
Promise.all([
    faceapi.loadFaceLandmarkModel(location.origin + '/static/models'),
    faceapi.loadFaceRecognitionModel(location.origin + '/static/models'),
    faceapi.loadTinyFaceDetectorModel(location.origin + '/static/models'),
    faceapi.loadFaceLandmarkTinyModel(location.origin + '/static/models'),
    faceapi.loadFaceExpressionModel(location.origin + '/static/models'),
]);
//비디오 가져오기
video.addEventListener('play', () => {

    //랜드마크 값을 행렬형태로 담기위한 캔버스
    var canvas_face = document.createElement("canvas");
    canvas_face.width = video.videoWidth;
    canvas_face.height = video.videoHeight;

    var ctx_face = canvas_face.getContext('2d');

    const displaySize = { width: video.videoWidth, height: video.videoHeight };

    setInterval(async() => {
        const detections = await faceapi
            .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()) // 얼굴 감지
            .withFaceLandmarks(); // 랜드마크의 좌표들을 반환

        //감지한 랜드마크의 크기를 조정
        const resizedDetections = faceapi.resizeResults(detections, displaySize);

        //표정 정보 저장
        const detectionlandmarks = await faceapi
            .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceExpressions(); //분석된 표정의 정보를 반환

        //표정 정보 읽어 저장
        let maxVal = 0;
        for (let i = 0; i < 7; i++) {
            const emote = "detectionlandmarks[0].expressions." + emotions[i];
            let val
            try {
                val = eval(emote);
            } catch {
                val = 0;
            }
            if (maxVal < val) {
                maxVal = val;
                emotion = emotions[i];
            }
        }

        // 여기부터는 눈 판정
        var landmarks;
        let execute = true;
        try {
            landmarks = resizedDetections[0].landmarks;
            closeEye = 2;
        } catch (e) {
            execute = false;
        }
        if (execute) {
            //각각의 랜드마크 위치(특징점 68개)를 가져옴
            const landmarkPositions = landmarks.positions;
            // console.log(landmarkPositions);

            x_ = landmarkPositions[44 - 1].x;
            y_ = landmarkPositions[44 - 1].y;
            w_ = landmarkPositions[45 - 1].x - landmarkPositions[44 - 1].x;
            h_ = landmarkPositions[48 - 1].y - landmarkPositions[44 - 1].y;

            //픽셀 데이터로 변환
            ctx_face.clearRect(0, 0, canvas_face.width, canvas_face.height)
            ctx_face.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
            var frame = ctx_face.getImageData(0, 0, video.videoWidth, video.videoHeight);

            let p_ = Math.floor(x_ + w_ / 2) + Math.floor(y_ + h_ / 2) * video.videoWidth;
            let v_ = Math.floor((frame.data[p_ * 4 + 0] + frame.data[p_ * 4 + 1] + frame.data[p_ * 4 + 2]) / 3);

            irisC.push(v_);
            if (irisC.length > 100) {
                irisC.shift();
            } //

            let meanIrisC = irisC.reduce(function(sum, element) {
                return sum + element;
            }, 0);
            meanIrisC = meanIrisC / irisC.length;
            let vThreshold = 1.2;

            let currentIrisC = irisC[irisC.length - 1];

            if (currentIrisC >= meanIrisC * vThreshold) {
                closeEye = 0;
            } else {
                closeEye = 1;
            }
        }

        //눈정보와 함께 저장
        socket.emit('face', { 'emote': emotion, 'eye': closeEye });
    }, 100);
})
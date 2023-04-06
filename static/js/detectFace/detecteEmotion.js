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

const vThreshold = 1.1;

var emotion = "neutral"; //표정 기본값
var eyeStates = [];
let irisC = [];

let almost_sleep = 0;

let eye_accuracy = 0;
let meanIrisC;
// Load the models from the Models folder
Promise.all([
    faceapi.loadFaceLandmarkModel(location.origin + '/static/models'),
    faceapi.loadFaceRecognitionModel(location.origin + '/static/models'),
    faceapi.loadTinyFaceDetectorModel(location.origin + '/static/models'),
    faceapi.loadFaceLandmarkModel(location.origin + '/static/models'),
    faceapi.loadFaceLandmarkTinyModel(location.origin + '/static/models'),
    faceapi.loadFaceRecognitionModel(location.origin + '/static/models'),
    faceapi.loadFaceExpressionModel(location.origin + '/static/models'),
]);
//비디오 가져오기
video.addEventListener('play', () => {

    // //랜드마크 값을 행렬형태로 담기위한 캔버스
    // var canvas_face = document.createElement("canvas");
    // canvas_face.width = video.videoWidth;
    // canvas_face.height = video.videoHeight;

    // var ctx_face = canvas_face.getContext('2d');

    const displaySize = { width: video.videoWidth, height: video.videoHeight };

    setInterval(async() => {
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
        socket.emit('face', { 'emote': emotion, 'eye': almost_sleep });
    }, 100);
})
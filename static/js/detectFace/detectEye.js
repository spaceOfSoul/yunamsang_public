let oldLeftEye = new Array(2);
let oldRightEye = new Array(2);
let oldNose = new Array(2);

const interval = 10;
let leftInterval = interval;
const ctrack = new clm.tracker();

var drawRequest;

let count = 0;
let blink_count = 0;

function makeCopyVideo() {
    const vid = document.createElement('video');
    vid.style = 'display : None';
    vid.autoplay = true;
    return vid;
}

const c_video = makeCopyVideo();

navigator.mediaDevices.getUserMedia(mediaConstraints)
    .then((stream) => {
        c_video.srcObject = stream;
    })

c_video.addEventListener('loadedmetadata', (e) => {
    // 비디오 크기
    var inputVideoW = c_video.videoWidth;
    var inputVideoH = c_video.videoHeight;

    c_video.width = inputVideoW;
    c_video.height = inputVideoH;

    // video.width = 0;
    // video.height = 0;

    loop();

    document.addEventListener("clmtrackrConverged", clmtrackrConvergedHandler);
    // 얼굴 모델 데이터 설정
    ctrack.init(pModel);
    // 얼굴 감지 시작
    ctrack.start(c_video);

});

let isTen = 0;
let start = 0;
//반복 함수
function loop(callback) {
    // requestAnimationFrame
    drawRequest = requestAnimationFrame(loop);

    // for timer
    count = callback;

    if (start == 0) {
        start = Date.now();
    }
    if (Date.now() - start >= 5000) {
        start = Date.now();
        if (blink_count >= 3.65) { // 분 당 43.91번이나 데모를 위해 5초로 줄임
            almost_sleep = 1;
        } else {
            almost_sleep = 0;
        }
        blink_count = 0;
    }

    // 좌표를 얻을 수 있는지 여부
    if (ctrack.getCurrentPosition()) {

        var list = ctrack.getCurrentPosition();
        if (list.length > 50) {

            var leftEye = list[27];
            var rightEye = list[32];
            var nose = list[37];

            var dxLE = leftEye[0] - oldLeftEye[0];
            var dyLE = leftEye[1] - oldLeftEye[1];
            var dLE = Math.sqrt(dxLE * dxLE + dyLE * dyLE);

            var dxRE = rightEye[0] - oldRightEye[0];
            var dyRE = rightEye[1] - oldRightEye[1];
            var dRE = Math.sqrt(dxRE * dxRE + dyRE * dyRE);

            var dxN = nose[0] - oldNose[0];
            var dyN = nose[1] - oldNose[1];
            var dN = Math.sqrt(dxN * dxN + dyN * dyN);

            var dyLE = leftEye[1] - oldLeftEye[1];
            var dyRE = rightEye[1] - oldRightEye[1];
            var dyN = nose[1] - oldNose[1];


            //1회 검출 후에는 즉시 검출하지 않게 한다
            // if (leftInterval < 0) {
            //눈이 아래 방향 (y의 + 방향)으로 어느 정도 움직이면 (눈을 닫았다)
            if (dyLE > 0.5) {
                //코의 변화량 dN보다 눈의 변화량 dLE 쪽이 크다.
                if (dLE - dN > 0.3) {
                    blink_count++;
                }
            }
            // }

            oldLeftEye[0] = leftEye[0];
            oldLeftEye[1] = leftEye[1];
            oldRightEye[0] = rightEye[0];
            oldRightEye[1] = rightEye[1];
            oldNose[0] = nose[0];
            oldNose[1] = nose[1];

            // leftInterval--;
        }
    }
}

function clmtrackrLostHandler() {
    // Remove Event
    document.removeEventListener("clmtrackrLost", clmtrackrLostHandler);
    document.removeEventListener("clmtrackrConverged", clmtrackrConvergedHandler);

    // 반복 처리 정지
    cancelAnimationFrame(drawRequest);
    // 얼굴 검출 처리 정지
    ctrack.stop();
}

function clmtrackrConvergedHandler() {
    // Remove Event
    document.removeEventListener("clmtrackrLost", clmtrackrLostHandler);
    document.removeEventListener("clmtrackrConverged", clmtrackrConvergedHandler);
}
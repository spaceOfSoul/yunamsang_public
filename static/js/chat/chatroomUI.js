var myVideo;

document.addEventListener("DOMContentLoaded", (event) => {
    myVideo = document.getElementById("local_vid");
    myVideo.onloadeddata = () => { console.log("W,H: ", myVideo.videoWidth, ", ", myVideo.videoHeight); };
    const muteBttn = document.getElementById("bttn_mute");
    const muteVidBttn = document.getElementById("bttn_vid_mute");
    const callEndBttn = document.getElementById("call_end");
    const chatButton = document.getElementById("bttn_chat");

    muteBttn.addEventListener("click", (event) => {
        audioMuted = !audioMuted;
        setAudioMuteState(audioMuted);
    });
    muteVidBttn.addEventListener("click", (event) => {
        videoMuted = !videoMuted;
        setVideoMuteState(videoMuted);
    });
    callEndBttn.addEventListener("click", (event) => {
        window.location.replace("/");
    });

    document.getElementById("room_link").innerHTML = `혹은 링크: <span class="heading-mark">${window.location.href}</span>`;

});

//비디오 개체 생성
function makeVideoElement(element_id, display_name) {
    let wrapper_div = document.createElement("div");
    let vid_wrapper = document.createElement("div");
    let vid = document.createElement("video");
    let name_text = document.createElement("div");

    wrapper_div.id = "div_" + element_id;
    vid.id = "vid_" + element_id;
    //비디오 좌우반전
    vid.style = 'transform: rotateY(180deg);-webkit-transform:rotateY(180deg); /* Safari and Chrome */ -moz-transform:rotateY(180deg); /* Firefox */';

    wrapper_div.className = "shadow video-item";
    vid_wrapper.className = "vid-wrapper";
    name_text.className = "display-name";

    vid.autoplay = true;
    name_text.innerText = display_name;

    vid_wrapper.appendChild(vid);
    wrapper_div.appendChild(vid_wrapper);
    wrapper_div.appendChild(name_text);

    return wrapper_div;
}

function addVideoElement(element_id, display_name) {
    document.getElementById("video_grid").appendChild(makeVideoElement(element_id, display_name));
}

function removeVideoElement(element_id) {
    let v = getVideoObj(element_id);
    if (v.srcObject) {
        v.srcObject.getTracks().forEach(track => track.stop());
    }
    v.removeAttribute("srcObject");
    v.removeAttribute("src");

    document.getElementById("div_" + element_id).remove();
}

function getVideoObj(element_id) {
    return document.getElementById("vid_" + element_id);
}

// 작동하지 않음
// "div_" + element_id 방식으로 찾는 모든 함수가 작동을 안함.
function changeVideoText(element_id, txt) {
    const v = document.getElementById("div_" + element_id);
    v.getElementsByClassName('display-name');
    v.innerText = v.innerText + ' ' + txt;
}

function setAudioMuteState(flag) {
    let local_stream = myVideo.srcObject;
    local_stream.getAudioTracks().forEach((track) => { track.enabled = !flag; });
    // switch button icon
    document.getElementById("mute_icon").innerText = (flag) ? "mic_off" : "mic";
}

function setVideoMuteState(flag) {
    let local_stream = myVideo.srcObject;
    local_stream.getVideoTracks().forEach((track) => { track.enabled = !flag; });
    // switch button icon
    document.getElementById("vid_mute_icon").innerText = (flag) ? "videocam_off" : "videocam";
}
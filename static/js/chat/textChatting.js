const text_input = document.querySelector('#chat-input');
const chat_form = document.querySelector('form');
const chat_content = document.querySelector('.chat-content');


chat_form.addEventListener('submit', (event) => {
    event.preventDefault();
    socket.emit("chat", text_input.value);
    text_input.value = "";
});

socket.on("chat", (data) => {
    console.log("message : ", data);
    if (myID == data.sid) {
        $('.chat-content').append(`<li>
        <p class = "myname" style = "margin-bottom :0px;margin-top:10px; font-size:12px">${data.sender}</p>
        <span class = "chat-box mine">${data.message}</span>
        </li>`);
    } else {
        $('.chat-content').append(`<li>
        <p style = "margin-bottom :0px;margin-top:10px; font-size:12px">${data.sender}</p>
        <span class = "chat-box">${data.message}</span>
        </li>`);
    }
    chat_content.scrollTop = chat_content.scrollHeight;
});
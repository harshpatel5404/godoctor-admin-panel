const socket = io();

socket.on("connect", () => {
  console.log("Connected to server with socket ID:", socket.id);
});

async function formatAMPM(date) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
    const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
    return `${formattedHours}:${formattedMinutes} ${ampm}`;
}

function isTodayMatchDate(inputString) {
    const parsedDate = new Date(inputString);
    if (isNaN(parsedDate)) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    parsedDate.setHours(0, 0, 0, 0);

    return parsedDate.getTime() === today.getTime();
}

function AutoScrollBottom() {
    let chatDetail = document.getElementById('scrollbottom');
    chatDetail.scrollTop = chatDetail.scrollHeight;
}

function NewDay(date) {
    let data = `<li class="text-center my-2">
                    <span class="f-w-500">${date}</span>
                </li>`;
    return data;
}

function LeftUserMessage(message, date) {
    let data = `<li>
                    <div class="message my-message py-1 mb-1 costycls">
                        <div class="message-data text-end m-0"><span class="message-data-time">${date}</span></div>${message.replace(/\n/g, '<br>')}
                    </div>
                </li>`;
    return data;
}

function RightUserMessage(message, date) {
    let data = `<li class="clearfix">
                    <div class="message other-message pull-right py-1 mb-1 chat_background costycls">
                        <div class="message-data m-0"><span class="message-data-time">${date}</span></div>${message.replace(/\n/g, '<br>')}
                    </div>
                </li>`;
    return data;
}

const uid = document.getElementById('chat_u_id').value;

document.addEventListener('DOMContentLoaded', function () {
    const inputBox = document.getElementById('chat_input');
    const sendButton = document.getElementById('chat_send_btn');
    
    async function sendMessage() {
        const message = inputBox.value.trim();
        if (message) {
            const ouid = document.getElementById('senderu_id').value;
            const lcd = document.getElementById('lmcdcd').value;

            socket.emit(`Add_new_chat`, {id: uid, sender_id: uid, recevier_id: ouid, message: message, status: 'doctor' });

            let date = await formatAMPM(new Date());
            
            if (isTodayMatchDate(lcd) == false) {
                let ndli = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
                $("#chat_detail").append(NewDay(ndli));
                $("#lmcdcd").val(ndli)
            }

            $("#chat_detail").append(RightUserMessage(message, date));

            AutoScrollBottom();

            $("#chat_profile_time").text("").text(`${inputBox.dataset.last} ${inputBox.dataset.message} ${date}`);

            const chatList = document.getElementById("chat_user_list");
            const clicked = chatList.querySelector(".chat_div.chat_background");

            const statusEl = clicked.querySelector(".status");

            if (statusEl) {
                const dateSpan = statusEl.querySelector("span");
                let nm = message.length > 25 ? message.slice(0, 26) + '...' : message;
                if (dateSpan) {
                    dateSpan.textContent = '1s';
                    statusEl.innerHTML = nm + ' ' + dateSpan.outerHTML;
                } else {
                    statusEl.innerHTML = nm + ' <span class="f-w-400">' + '1s' + '</span>';
                }
            }

            chatList.insertBefore(clicked, chatList.firstElementChild);

            inputBox.value = '';
        }
    }

    inputBox.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                return;
            } else {
                e.preventDefault();
                sendMessage();
            }
        }
    });

    sendButton.addEventListener('click', sendMessage);
});


socket.on(`New_Chat_Reaload${uid}`, async(mess) => {
    if (mess) {
        const { recevier_id, sender_id, date, today, messages } = mess;
        
        const chatList = document.getElementById("chat_user_list");
        const clicked = chatList.querySelector(`.cl${sender_id}`);
        
        if (clicked) {

            const statusEl = clicked.querySelector(".status");
            const dot1 = clicked.querySelector(".dot1");
    
            const ouid = document.getElementById('senderu_id').value;
            
            if (ouid == sender_id) {
                const inputBox = document.getElementById('chat_input');
                
                if (today != '0') {
                    let ndli = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
                    $("#chat_detail").append(NewDay(ndli));
                    $("#lmcdcd").val(ndli)
                }
    
                $("#chat_detail").append(LeftUserMessage(messages, date));
    
                AutoScrollBottom();
    
                $("#chat_profile_time").text("").text(`${inputBox.dataset.last} ${inputBox.dataset.message} ${date}`);
    
                socket.emit("Web_Chat_Read", {sender_id, recevier_id, status: 'doctor'});
                
                dot1.classList.add("d-none");
            } else dot1.classList.remove("d-none");
    
            if (statusEl) {
                const dateSpan = statusEl.querySelector("span");
                let nm = messages.length > 25 ? messages.slice(0, 26) + '...' : messages;
                if (dateSpan) {
                    dateSpan.textContent = '1s';
                    statusEl.innerHTML = nm + ' ' + dateSpan.outerHTML;
                } else {
                    statusEl.innerHTML = nm + ' <span class="f-w-400">' + '1s' + '</span>';
                }
            }
            chatList.insertBefore(clicked, chatList.firstElementChild);
            
        } else {

            const base_url = window.location.origin;
            $.ajax({
                url: base_url + '/chat/new_user_chat_profile',
                type: 'POST',
                dataType: 'JSON',
                data: {sender_id},
                success: function (res){
                    if (res.status == true) {
                        let ncdata = `<div class="d-flex align-items-center rounded-3 my-1 p-1 chat_div hand-hover cl${sender_id}" 
                                        id="chat_user" data-sender="${sender_id}" data-reciver="${recevier_id}" data-name="${res.user.name.toLowerCase()}">

                                        <div class="m-r-10 p-2 d-flex align-items-center">
                                            <img class="rounded-circle" height="50" width="50" src="${res.user.image != '' ? '../../'+ res.user.image : '../../images/profile.png' }" alt="" onerror="this.src='../../images/profile.png'">
                                        </div>

                                        <div>
                                            <h5 class="name mb-1 d-flex">
                                                ${res.user.name}
                                                <span class="dot1" id="new_message" style="margin-left: 5px;"></span>

                                                <span class="loadingDots d-none" id="user_list_typing"><span class="dot1 m-0"></span><span class="dot2 m-0"></span><span class="dot3 m-0"></span><span class="dot4 m-0"></span></span> 
                                            </h5>
                                            <p class="status f-w-700 m-0">${messages.length > 25 ? messages.slice(0, 26) + '...' : messages} <span class="f-w-400">1s</span></p>
                                        </div>
                                    </div>`;

                        if (chatList) {
                            chatList.insertAdjacentHTML("afterbegin", ncdata);
                        }

                    }
                }
            });

        }
    }
});

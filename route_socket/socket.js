const ChatFunction = require("../route_function/chat_function");
const sendOneNotification = require("../middleware/send");
const { DataFind } = require("../middleware/database_query");

async function SocketList(io) {

io.on("connection", (socket) => {
    socket.on("Add_new_chat", async(data) => {
        const { id, sender_id, recevier_id, message, status } = data;
        
        const missingField = ["id", "sender_id", "recevier_id", "message", "status"].find(field => !data[field]);

        if (!missingField) {
            
            const hostname = socket.request.headers.host;
            const protocol = socket.request.connection.encrypted ? 'https' : 'http';

            const schat = await ChatFunction.Chat_Save(id, sender_id, recevier_id, message, status, hostname, protocol);
            
            if (schat.status == true) {
                socket.broadcast.emit(`New_Chat_Reaload${recevier_id}`, schat);
            }
        }
    });



    socket.on("Web_Chat_Read", async(data) => {
        const { sender_id, recevier_id, status } = data;
        
        const missingField = ["sender_id", "recevier_id", "status"].find(field => !data[field]);

        if (!missingField) {
            const hostname = socket.request.headers.host;
            const protocol = socket.request.connection.encrypted ? 'https' : 'http';
            await ChatFunction.ReadMessage(sender_id, recevier_id, status, hostname, protocol);
        }
    });



    socket.on("Audio_Video_Call", async(data) => {
        const { id, uid } = data;
        
        const missingField = ["id", "uid"].find(field => !data[field]);
        
        if (!missingField) {
            
            const doctor = await DataFind(`SELECT logo, name FROM tbl_doctor_list WHERE id = '${id}'`);
            
            if (doctor != '') {
                socket.broadcast.emit(`Other_Audio_Video_Call${uid}`, {doctor_id: id, ...doctor[0]});
                sendOneNotification(`Dr. ${doctor[0].name} is ready to connect with you for personalized care – join the video call now for your treatment guidance`, 'customer', uid, 1);
            }
        }
    });

    socket.on("Audio_video_call_Cut", async(data) => {
        const {id, uid} = data;
        
        const missingField = ["id", "uid"].find(field => !data[field]);
        
        if (!missingField) {
            socket.broadcast.emit(`Other_user_Call_Cut${uid}`, {uid: id});
        }
    });
    
    // socket.on("disconnect", () => {
    //     console.log("Socket disconnected");
    // });
    
});

}



module.exports = { SocketList }
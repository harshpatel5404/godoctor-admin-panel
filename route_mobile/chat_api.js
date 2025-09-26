/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */



const express = require("express");
const router = express.Router();
const ChatFunction = require("../route_function/chat_function");
const AllFunction = require("../route_function/function");

// ============= Chat ================ //

function formatAMPM(date) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
    const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
    return `${formattedHours}:${formattedMinutes} ${ampm}`;
}

function storytime(utime) {
    const currentTime = new Date();
    const storyTime = new Date(utime);

    const timeDifference = currentTime - storyTime;
    const years = Math.floor(timeDifference / (1000 * 60 * 60 * 24 * 365));
    const days = Math.floor((timeDifference % (1000 * 60 * 60 * 24 * 365)) / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDifference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDifference % (1000 * 60 * 60)) / (1000 * 60));
    
    let dtime = "";
    if (years > 0) {
        dtime = `${years}y`;
    } else if (days > 0) {
        dtime = `${days}d`;
    } else if (hours > 0) {
        dtime = `${hours}h`;
    } else if (minutes > 0) {
        dtime = `${minutes}m`;
    } else {
        const seconds = Math.floor((timeDifference % (1000 * 60)) / 1000);
        if (seconds == "0") dtime = `1s`;
        else dtime = `${seconds}s`;
    }
    return dtime;
}

router.post("/save_chat", async(req, res)=>{
    try {
        const {id, sender_id, recevier_id, message, status} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "sender_id", "recevier_id", "message", "status"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        if (sender_id == recevier_id) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Invaild Id Found' });

        const schat = await ChatFunction.Chat_Save(id, sender_id, recevier_id, message, status, req.hostname, req.protocol);
        if (schat == 1) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });
        if (schat == 2) res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Message Save successful', schat });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





router.post("/all_chat", async(req, res)=>{
    try {
        const {id, status} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "status"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        let chat_list;
        if (status == "customer") {
            chat_list = await ChatFunction.AllChatList(id, 'customer');
        } else if (status == "doctor") {
            chat_list = await ChatFunction.AllChatList(id, 'doctor');
        }        

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', chat_list });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





router.post("/user_to_user_chat_list", async(req, res)=>{
    try {
        const { id, sender_id, recevier_id, status} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "sender_id", "recevier_id", "status"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        if (sender_id == recevier_id) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Invaild Id Found' });

        const uchat = await ChatFunction.UserToUserChatList(id, sender_id, recevier_id, status, req.hostname, req.protocol)
        
        res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', user: uchat.user, all_chat: uchat.all_chat });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
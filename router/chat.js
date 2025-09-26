/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */


const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const ChatFunction = require("../route_function/chat_function");
const { DataFind } = require("../middleware/database_query");



router.get("/list", auth, async(req, res)=>{
    try {
        let chat_list = await ChatFunction.AllChatList(req.user.admin_id, 'doctor');
        if (chat_list.length == 0) {
            req.flash('errors', `Chat not found!`);
            return res.redirect("back");
        }
        
        let fchat = chat_list[0];
        const one_chat_list = await ChatFunction.UserToUserChatList(req.user.admin_id, fchat.sender_id, fchat.receiver_id, "doctor", req.hostname, req.protocol);

        let send_id =  req.user.admin_id == fchat.sender_id ? fchat.receiver_id : fchat.sender_id;
        
        res.render("chat", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, chat_list, one_chat_list, user:fchat, send_id
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/chat_list", auth, async(req, res)=>{
    try {
        const {sender, reciver} = req.body;

        const chat_list = await ChatFunction.UserToUserChatList(req.user.admin_id, sender, reciver, "doctor", req.hostname, req.protocol);
        let send_id = req.user.admin_id == sender ? reciver : sender;
        
        res.send({ user: chat_list.user, last_data: chat_list.all_chat.at(-1).chat.at(-1).date, all_chat: chat_list.all_chat, send_id, 
                    last: req.lan.ld.Service, message: req.lan.ld.Message });
    } catch (error) {
        console.log(error);
        res.send({ user: [], last_data: '', all_chat: [], send_id: 0, message: '' });
    }
});

router.post("/new_user_chat_profile", auth, async(req, res)=>{
    try {
        const {sender_id} = req.body;
        
        const user = await DataFind(`SELECT id, image, name FROM tbl_customer WHERE id = '${sender_id}'`);

        res.send({ status: user != '' ? true : false, user: user != '' ? user[0] : {} });
    } catch (error) {
        console.log(error);
        res.send({ status: false, user: {} });
    }
});



module.exports = router;
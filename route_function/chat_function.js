/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */



let mysql = require('mysql');
const sendOneNotification = require("../middleware/send");
const { DataFind, DataInsert, DataUpdate } = require("../middleware/database_query");


// ============= Chat ================ //

async function formatAMPM(date) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
    const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
    return `${formattedHours}:${formattedMinutes} ${ampm}`;
}

async function ChatTime(utime) {
    const currentTime = new Date();
    const storyTime = new Date(utime);

    const timeDifference = currentTime - storyTime;
    const days = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
    const hours = Math.floor(timeDifference / (1000 * 60 * 60));
    const minutes = Math.floor((timeDifference % (1000 * 60 * 60)) / (1000 * 60));
    
    let dtime = 0;
    if (hours == "0" && minutes == "0") {
        const seconds = Math.floor((timeDifference % (1000 * 60)) / 1000);
        if (seconds == "0") dtime = `1s`;
        else dtime = `${seconds}s`;
    } else if (hours == "0" && minutes != "0") {
        dtime = `${minutes}m`;
    } else if (days == "0" && hours != "0" && minutes != "0") {
        dtime = `${hours}h`;
    } else {
        dtime = `${days}d`;
    }
    return dtime;
}

async function unreadcheck(sender, receiver, status) {
    const sitter = await DataFind(`SELECT * FROM tbl_chat_new
                                    WHERE (sender = '${sender}' AND receiver = '${receiver}') OR (sender = '${receiver}' AND receiver = '${sender}')`);

    let check = 0;
    if (sitter != "") {
        if (status == "customer") {
            check = sitter[0].dcheck == "1" ? 1 : 0;
        } 
        if (status == "doctor") {
            check = sitter[0].ccheck == "1" ? 1 : 0;
        }
        return check;
    }

    
    return check;
}



async function Chat_Save(uid, sender_id, recevier_id, message, status, hostname, protocol) {
    try {
        if (!uid || !sender_id || !recevier_id  || !message || !status ) return {status: true, typee: 1};

        // Check Message Read
        const chat_data = await DataFind(`SELECT * FROM tbl_chat_new 
                                            WHERE (sender = '${sender_id}' AND receiver = '${recevier_id}') OR (sender = '${recevier_id}' AND receiver = '${sender_id}') `);

        if (chat_data != "") {

            if (status == "customer") {
                if (await DataUpdate(`tbl_chat_new`, `dcheck = '1'`,
                    `(sender = '${sender_id}' AND receiver = '${recevier_id}') OR (sender = '${recevier_id}' AND receiver = '${sender_id}')`, hostname, protocol) == -1) {
                    return {status: true, typee: 2};
                }
            } else {
                if (await DataUpdate(`tbl_chat_new`, `ccheck = '1'`,
                    `(sender = '${sender_id}' AND receiver = '${recevier_id}') OR (sender = '${recevier_id}' AND receiver = '${sender_id}')`, hostname, protocol) == -1) {
                    return {status: true, typee: 2};
                }
            }

        } else {

            if (status == "customer") {
                if (await DataInsert(`tbl_chat_new`, `sender, receiver, dcheck, ccheck`, `'${recevier_id}', '${sender_id}', '1', '0'`, hostname, protocol) == -1) {
                    return {status: true, typee: 2};
                }
            } else {
                if (await DataInsert(`tbl_chat_new`, `sender, receiver, dcheck, ccheck`, `'${sender_id}', '${recevier_id}', '0', '1'`, hostname, protocol) == -1) {
                    return {status: true, typee: 2};
                }
            }
        }

        const chat_check = await DataFind(`SELECT * FROM tbl_chat
                                            WHERE (sender_id = '${sender_id}' AND receiver_id = '${recevier_id}') OR (sender_id = '${recevier_id}' AND receiver_id = '${sender_id}') 
                                            ORDER BY id DESC LIMIT 1 `);

        // Message Save
        let ndate = new Date().toISOString();
        let today_date = "0";
        const emessage = mysql.escape(message);
        if (chat_check == "") {
            const dateString = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            today_date = dateString;

            const ms = await DataFind(`SELECT id, defaultm FROM tbl_doctor_setting where doctor_id = '${status == "doctor" ? sender_id : recevier_id}'`);
            let dmessage = '';
            if (ms != '') {
                if (ms[0].defaultm != '') dmessage = ms[0].defaultm;
                else dmessage = 'Hello 👋';
            } else dmessage = 'Hello 👋';

            if (await DataInsert(`tbl_chat`, `sender_id, receiver_id, date, message`, `'${sender_id}', '${recevier_id}', '${ndate}', '${dmessage}'`, hostname, protocol) == -1) {
                return {status: true, typee: 2};
            }

            if (await DataInsert(`tbl_chat`, `sender_id, receiver_id, date, message`, `'${sender_id}', '${recevier_id}', '${ndate}', ${emessage}`, hostname, protocol) == -1) {
                return {status: true, typee: 2};
            }

        } else {

            let cdate = new Date(chat_check[0].date);
            let ctoday = new Date();
            cdate.setHours(0, 0, 0, 0);
            ctoday.setHours(0, 0, 0, 0);

            if (cdate.getTime() != ctoday.getTime()) {
                const dateString = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                today_date = dateString;
            }

            if (await DataInsert(`tbl_chat`, `sender_id, receiver_id, date, message`, `'${sender_id}', '${recevier_id}', '${ndate}', ${emessage}`, hostname, protocol) == -1) {
                return {status: true, typee: 2};
            }
        }

        if (status == "customer") {
            sendOneNotification(message, 'doctor', recevier_id, 1);
        } else {
            sendOneNotification(message, 'customer', recevier_id, 1);
            sendOneNotification(message, 'customer', recevier_id, 2);
        }

        return { status: true, recevier_id, sender_id, date: await formatAMPM(new Date()), today: today_date, messages:message }
    } catch (error) {
        console.log(error);
        return {status: false}
    }
}



async function AllChatList(id, status) {
    try {
        let chat_data = [];
        if (status == 'customer') {
            
            chat_data = await DataFind(`SELECT t.id, t.sender_id, t.receiver_id, t.date, t.message, COALESCE(doc.logo, '') AS logo, COALESCE(doc.name, '') AS name,
                                        COALESCE(cn.ccheck, 0) AS status
                                        FROM (
                                            SELECT c.id, c.sender_id, c.receiver_id, c.date, c.message,
                                                ROW_NUMBER() OVER (PARTITION BY LEAST(c.sender_id, c.receiver_id), 
                                                        GREATEST(c.sender_id, c.receiver_id) 
                                                    ORDER BY c.date DESC, c.id DESC) AS rn
                                            FROM tbl_chat c
                                            WHERE (c.sender_id = '${id}' OR c.receiver_id = '${id}')
                                        ) t
                                        LEFT JOIN tbl_chat_new AS cn ON (cn.sender = t.sender_id AND cn.receiver = t.receiver_id) OR 
                                                                        (cn.sender = t.receiver_id AND cn.receiver = t.sender_id)
                                        LEFT JOIN tbl_doctor_list AS doc ON doc.id = CASE WHEN t.sender_id = '${id}' THEN t.receiver_id ELSE t.sender_id END
                                        WHERE t.rn = 1
                                        ORDER BY t.id DESC;`);
            
        } else {
    
            chat_data = await DataFind(`SELECT t.id, t.sender_id, t.receiver_id, t.date, t.message, COALESCE(cus.image, '') AS image, COALESCE(cus.name, '') AS name, 
                                        COALESCE(cn.dcheck, 0) AS status
                                        FROM (
                                            SELECT c.id, c.sender_id, c.receiver_id, c.date, c.message,
                                                ROW_NUMBER() OVER (PARTITION BY LEAST(c.sender_id, c.receiver_id), 
                                                        GREATEST(c.sender_id, c.receiver_id) 
                                                    ORDER BY c.date DESC, c.id DESC) AS rn
                                            FROM tbl_chat c
                                            WHERE (c.sender_id = '${id}' OR c.receiver_id = '${id}')
                                        ) t
                                        LEFT JOIN tbl_chat_new AS cn ON (cn.sender = t.sender_id AND cn.receiver = t.receiver_id) OR 
                                                                        (cn.sender = t.receiver_id AND cn.receiver = t.sender_id)
                                        LEFT JOIN tbl_customer AS cus ON cus.id = CASE WHEN t.sender_id = '${id}' THEN t.receiver_id ELSE t.sender_id END
                                        WHERE t.rn = 1
                                        ORDER BY t.id DESC;`);
    
        }
    
        for (const val of chat_data) {
            val.date = await ChatTime(val.date, 0);
            if (val.message.length > 25) {
                val.message = val.message.slice(0, 26) + '...';
            }  
        }
    
        return chat_data;
    } catch (error) {
        console.log(error);
        return { status: false };
    }
}



async function UserToUserChatList(id, sender_id, receiver_id, status, hostname, protocol) {
    try {
        let userQuery = "";
        let updateField = "";

        if (status === "customer") {
            userQuery = `SELECT COALESCE(logo, '') AS logo, COALESCE(name, '') AS name 
                        FROM tbl_doctor_list WHERE id = '${id == sender_id ? receiver_id : sender_id}'`;

            updateField = "ccheck = '0'";

        } else if (status === "doctor") {
            
            userQuery = `SELECT image, name
                        FROM tbl_customer WHERE id = '${id == sender_id ? receiver_id : sender_id}'`;
                         
            updateField = "dcheck = '0'";
        }
        
        const [user, chat_data, updateResult] = await Promise.all([
            userQuery ? DataFind(userQuery) : [],
            DataFind(`SELECT id, date, message, sender_id FROM tbl_chat 
                        WHERE (sender_id = '${sender_id}' AND receiver_id = '${receiver_id}') OR (sender_id = '${receiver_id}' AND receiver_id = '${sender_id}')`),

            DataUpdate(`tbl_chat_new`, updateField, `(sender = '${sender_id}' AND receiver = '${receiver_id}') OR (sender = '${receiver_id}' AND receiver = '${sender_id}')`, hostname, protocol)
        ]);

        if (updateResult === -1) {
            return { ResponseCode: 401, Result: false, message: process.env.dataerror };
        }

        const chatMap = new Map();
        for (const item of chat_data) {
            const dateString = new Date(item.date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

            if (!chatMap.has(dateString)) {
                chatMap.set(dateString, []);
            }

            chatMap.get(dateString).push({
                id: item.id,
                date: await formatAMPM(new Date(item.date)),
                message: item.message,
                status: item.sender_id == id ? 1 : 2
            });
        }

        const all_chat = Array.from(chatMap, ([date, chat]) => ({ date, chat }));

        return { status: true, user: user, all_chat };
    } catch (error) {
        console.error(error);
        return { ResponseCode: 500, status: false, message: "Internal Server Error" };
    }
}

async function ReadMessage(sender_id, receiver_id, status, hostname, protocol) {
    try {
        let updateField = ''
        if (status === "customer") updateField = "ccheck = '0'";
        else if (status === "doctor") updateField = "dcheck = '0'";

        if (await DataUpdate(`tbl_chat_new`, updateField, `(sender = '${sender_id}' AND receiver = '${receiver_id}') OR 
                                                            (sender = '${receiver_id}' AND receiver = '${sender_id}')`, hostname, protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, status:false, message: process.env.dataerror });
        }
        
        return {status:true };
    } catch (error) {
        console.log(error);
        return {status:false };
    }
}





module.exports = { formatAMPM, ChatTime, unreadcheck, AllChatList, Chat_Save, UserToUserChatList, ReadMessage }
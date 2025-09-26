const axios = require('axios');
const { DataFind } = require("./database_query");

const sendOneNotification = async (text, type, id, status, data, protocol, hostname) => {
    const general_setting = await DataFind(`SELECT * FROM tbl_general_settings`);

    if (general_setting != '') {

        // console.log(status);
        // console.log(data);
        // console.log(typeof data.title);

        // console.log(protocol);
        // console.log(hostname);
        
        if (status == 1) {
            
            if (general_setting[0].one_app_id != '' && general_setting[0].one_api_key != '') {
    
                const app_id = general_setting[0].one_app_id, api_key = general_setting[0].one_api_key;
            
                let message
                if (!data) {
                    message = {
                        app_id: app_id,
                        contents: { "en": text },
                        headings: { "en": general_setting[0].title },
                        included_segments: ["Subscribed Users"],
                        filters: [
                            { "field": "tag", "key": "subscription_user_Type", "relation": "=", "value": type },
                            { "operator": "AND" },
                            { "field": "tag", "key": "Login_ID", "relation": "=", "value": id }
                        ],
                        big_picture: `${protocol}://${hostname}/` + general_setting[0].dark_image
                    };
                    
                } else {
                    message = {
                        app_id: app_id,
                        contents: { "en": data.description != '' ? data.description : data.title },
                        headings: { "en": data.description != '' ? data.title : general_setting[0].title },
                        included_segments: ["Subscribed Users"],
                        filters: [
                            { "field": "tag", "key": "subscription_user_Type", "relation": "=", "value": type },
                            { "operator": "AND" },
                            { "field": "tag", "key": "Login_ID", "relation": "=", "value": id }
                        ],
                        big_picture: `${protocol}://${hostname}/` + (data.imageUrl != '' ? data.imageUrl : general_setting[0].dark_image),
                    };
                    
                }
            
                axios.post('https://onesignal.com/api/v1/notifications', message, {
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8',
                        'Authorization': `Basic ${api_key}`
                    }
                })
                .then(response => {
                    console.log('Notification sent successfully');
                })
                .catch(error => {
                    console.error(error.response.data);
                });
    
            }
            
        } else {
            
            if (general_setting[0].one_app_id_react != '' && general_setting[0].one_api_key_react != '') {
                
                const app_id = general_setting[0].one_app_id_react, api_key = general_setting[0].one_api_key_react;
                
                let message
                if (!data) {

                    message = {
                        app_id: app_id,
                        contents: { "en": text },
                        headings: { "en": general_setting[0].title },
                        included_segments: ["Subscribed Users"],
                        filters: [
                            { "field": "tag", "key": "user_id", "relation": "=", "value": id }
                        ],
                        big_picture: `${protocol}://${hostname}/` + general_setting[0].dark_image
                    };
                    
                } else {
                    
                    message = {
                        app_id: app_id,
                        contents: { "en": data.description != '' ? data.description : data.title },
                        headings: { "en": data.description != '' ? data.title : general_setting[0].title },
                        included_segments: ["Subscribed Users"],
                        filters: [
                            { "field": "tag", "key": "user_id", "relation": "=", "value": id }
                        ],
                        big_picture: `${protocol}://${hostname}/` + (data.imageUrl != '' ? data.imageUrl : general_setting[0].dark_image),
                    };
                    
                }
                axios.post('https://onesignal.com/api/v1/notifications', message, {
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8',
                        'Authorization': `Basic ${api_key}`
                    }
                })
                .then(response => {
                    console.log('React Notification sent successfully');
                })
                .catch(error => {
                    console.error(error.response.data);
                });
    
            }

        }

    }
    
}



module.exports = sendOneNotification;
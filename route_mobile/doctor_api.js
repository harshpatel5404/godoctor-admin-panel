/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */


const express = require("express");
const router = express.Router();
const bcrypt = require('bcrypt');
const multer  = require('multer');
const mysql = require('mysql');
const axios = require('axios');
const fs = require('fs-extra');
const path = require("path");
const AllFunction = require("../route_function/function");
const ChatFunction = require("../route_function/chat_function");
const sendOneNotification = require("../middleware/send");
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/database_query");



// ============= Signup ================ //

router.post("/mobile_signup", async(req, res)=>{
    try {
        const {ccode, phone, password} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["ccode", "phone", "password"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const cus_name = await DataFind(`SELECT * FROM tbl_doctor_list WHERE country_code = '${ccode}' AND phone = '${phone}'`);
        if(cus_name != "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Mobile number already registered!' });

        const phoneExists = await DataFind(`SELECT phone FROM tbl_doctor_list WHERE country_code = '${ccode}' AND phone = '${phone}'
                                            UNION SELECT phone FROM tbl_lab_list WHERE country_code = '${ccode}' AND phone = '${phone}'
                                            UNION SELECT phone FROM tbl_doctor_receptionist WHERE country_code = '${ccode}' AND phone = '${phone}'
                                            UNION SELECT phone FROM tbl_role_permission WHERE country_code = '${ccode}' AND phone = '${phone}'
                                            UNION SELECT phone FROM tbl_admin WHERE country_code = '${ccode}' AND phone = '${phone}'`);
        
        if (phoneExists && phoneExists.length > 0) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Mobile number already registered!' });

        const sitterid = await DataInsert(`tbl_doctor_list`, ` logo, cover_logo, name, email, country_code, phone, password, status, verification_status, per_patient_time, title, 
            subtitle, year_of_experience, description, cancel_policy, address, pincode, landmark, latitude, longitude, tot_favorite, commission, hospital_list, department_list, 
            wallet, cash_amount, success_cash, tot_payout, success_payout, medicine_payout, success_medicine_payout, join_date`,
            `'', '', '', '', '${ccode}', '${phone}', '${await bcrypt.hash(password, 10)}', '0', '0', '0', '', '', '0', '', '', '', '', '', '0', '0', '0', '0', '[]', '[]', '0', '0', 
            '0', '0', '0', '0', '0', '${new Date().toISOString().split("T")[0]}'`, req.hostname, req.protocol);

        if (sitterid == -1) return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });

        const udoc = await DataFind(`SELECT * FROM tbl_doctor_list WHERE country_code = '${ccode}' AND phone = '${phone}'`);
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Mobile signup Successful', status: 2, doctor_detail: udoc[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


AllFunction.ImageUploadFolderCheck(`./public/uploads/doctor`);
const storage4 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/doctor");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const doctor = multer({storage : storage4});

router.post("/general_detail_signup", doctor.fields([{name: 'logo', maxCount: 1}, {name: 'cover_logo', maxCount: 1}]), async(req, res)=>{
    try {
        const {id, name, email, title, subtitle, year_of_experi, description, cancel_policy } = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "name", "email", "title", "subtitle", "year_of_experi", "description", "cancel_policy"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        if(req.files) {
            if (!req.files.logo || !req.files.cover_logo) {
                if (req.files.logo) await AllFunction.DeleteImage("uploads/doctor/" + req.files.logo[0].filename);
                if (req.files.cover_logo) await AllFunction.DeleteImage("uploads/doctor/" + req.files.cover_logo[0].filename);
                return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Logo and cover Logo required!' });
            }
        } else {
            await AllFunction.DeleteImage("uploads/doctor/" + req.files.logo[0].filename);
            await AllFunction.DeleteImage("uploads/doctor/" + req.files.cover_logo[0].filename);
            return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Logo and cover Logo required!' });
        }

        const logo = req.files.logo ? "uploads/doctor/" + req.files.logo[0].filename : null;
        const cover_logo = req.files.cover_logo ? "uploads/doctor/" + req.files.cover_logo[0].filename : null;

        const doc = await DataFind(`SELECT * FROM tbl_doctor_list WHERE id = '${id}'`);
        if(doc == "") {
            await AllFunction.DeleteImage(logo);
            await AllFunction.DeleteImage(cover_logo);
            return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Id not Found!' });
        }
        
        const emailExists = await DataFind(`SELECT email FROM tbl_doctor_list WHERE email = '${email}'
                                            UNION SELECT email FROM tbl_lab_list WHERE email = '${email}'
                                            UNION SELECT email FROM tbl_role_permission WHERE email = '${email}'
                                            UNION SELECT email FROM tbl_admin WHERE email = '${email}'`);
        if(emailExists != "") {
            await AllFunction.DeleteImage(logo);
            await AllFunction.DeleteImage(cover_logo);
            return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Email already registered!' });
        }

        const esname = mysql.escape(name), sit_title = mysql.escape(title), sit_subtitle = mysql.escape(subtitle), sit_destitle = mysql.escape(description), 
                    sit_cantitle = mysql.escape(cancel_policy);

        if (await DataUpdate(`tbl_doctor_list`, `logo = '${logo}', cover_logo = '${cover_logo}', name = ${esname}, email = '${email}', title = ${sit_title}, subtitle = ${sit_subtitle}, 
            year_of_experience = '${year_of_experi}', description = ${sit_destitle}, cancel_policy = ${sit_cantitle}`, 
            `id = '${id}'`, req.hostname, req.protocol) == -1) {

            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        const udoc = await DataFind(`SELECT * FROM tbl_doctor_list WHERE id = '${id}'`);
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Gneral details add Successful', status: 3, doctor_detail: udoc[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/profile_edit_data', async (req, res) => {
    try {
        const {id } = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const profile_data = await DataFind(`SELECT id, logo, cover_logo, name, email, title, subtitle, year_of_experience, description, cancel_policy 
                                                FROM tbl_doctor_list WHERE id = '${id}'`);

        if(profile_data == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'User not Found!' });
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: "Profile data load successful", profile_data: profile_data[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/profile_edit', doctor.fields([{name: 'logo', maxCount: 1}, {name: 'cover_logo', maxCount: 1}]), async (req, res) => {
    try {
        const {id, name, email, title, subtitle, year_of_experi, description, cancel_policy } = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "name", "email", "title", "subtitle", "year_of_experi", "description", "cancel_policy"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const doc = await DataFind(`SELECT * FROM tbl_doctor_list WHERE id = '${id}'`);
        if(doc == "") {
            if (req.files) {
                if (req.files.logo) await AllFunction.DeleteImage("uploads/doctor/" + req.files.logo[0].filename);
                if (req.files.cover_logo) await AllFunction.DeleteImage("uploads/doctor/" + req.files.cover_logo[0].filename);
            }
            return res.status(200).json({ ResponseCode: 401, Result:false, message: 'User not Found!' });
        }

        let logo = '', cover_logo = '';
        if (req.files) {
            if (req.files.logo) {
                await AllFunction.DeleteImage(doc[0].logo);
                logo = "uploads/doctor/" + req.files.logo[0].filename;
            } else logo = doc[0].logo;

            if (req.files.cover_logo) {
                await AllFunction.DeleteImage(doc[0].cover_logo);
                cover_logo = "uploads/doctor/" + req.files.cover_logo[0].filename;
            } else cover_logo = doc[0].cover_logo;
        }

        if (doc[0].email != email) {
            const doc_name = await DataFind(`SELECT * FROM tbl_doctor_list WHERE email = '${email}'`);
            if(doc_name != "") {
                await AllFunction.DeleteImage(logo);
                await AllFunction.DeleteImage(cover_logo);
                return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Email already registered!' });
            }
        }

        const esname = mysql.escape(name), sit_title = mysql.escape(title), sit_subtitle = mysql.escape(subtitle), sit_destitle = mysql.escape(description),
                    sit_cantitle = mysql.escape(cancel_policy);

        if (await DataUpdate(`tbl_doctor_list`, `logo = '${logo}', cover_logo = '${cover_logo}', name = ${esname}, email = '${email}', title = ${sit_title}, subtitle = ${sit_subtitle}, 
            year_of_experience = '${year_of_experi}', description = ${sit_destitle}, cancel_policy = ${sit_cantitle}`, 
            `id = '${id}'`, req.hostname, req.protocol) == -1) {

            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        const doctor_detail = await DataFind(`SELECT * FROM tbl_doctor_list WHERE id = '${doc[0].id}'`);
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: "Profile edit successful", doctor_detail: doctor_detail[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.get("/hospital_department_list", async(req, res)=>{
    try {
        const department_list = await DataFind(`SELECT id, name, image FROM tbl_department_list WHERE status = '1' ORDER BY id DESC`);
        const hospital_list = await DataFind(`SELECT id, name, image FROM tbl_hospital_list WHERE status = '1' ORDER BY id DESC`);
        hospital_list.map(val => {
            val.image = val.image.split("&!!")[0];
        })

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', hospital_list, department_list });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/address_signup", async(req, res)=>{
    try {
        const {id, address, pincode, landmark, latitude, longitude, hospital_list, department_list } = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "address", "pincode", "landmark", "latitude", "longitude", "hospital_list", "department_list"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const doc = await DataFind(`SELECT * FROM tbl_doctor_list WHERE id = '${id}'`);
        if(doc == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Id not Found!' });
        
        const zonc = await DataFind(`SELECT * FROM tbl_zone WHERE ST_Contains(
                                        lat_lon_polygon,
                                        ST_SRID(ST_GeomFromText(CONCAT('POINT(', ${Number(longitude)}, ' ', ${Number(latitude)}, ')')), 4326)
                                    ) AND status = '1'`);

        if(zonc == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Your location is not within the zone.' });
        
        const esaddr = mysql.escape(address), eslandm = mysql.escape(landmark);

        if (doc[0].address == '' || doc[0].pincode == '' || doc[0].landmark == '' || doc[0].latitude == '' || doc[0].longitude == '') {

            const gs = await DataFind(`SELECT doctor_auto_approve FROM tbl_general_settings`);
            let gs_auapp = 0;

            if (gs != '') {
                if (gs[0].doctor_auto_approve > 0 && !isNaN(gs[0].doctor_auto_approve)) {
                    gs_auapp = gs[0].doctor_auto_approve
                }
            }

            if (await DataUpdate(`tbl_doctor_list`, `status = '1', verification_status = '${gs_auapp}', address = ${esaddr}, pincode = '${pincode}', landmark = ${eslandm}, 
                latitude = ${latitude}, longitude = '${longitude}', hospital_list = '${JSON.stringify(hospital_list)}', department_list = '${JSON.stringify(department_list)}'`, 
                `id = '${id}'`, req.hostname, req.protocol) == -1) {
    
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }
        }

        const dht = await DataFind(`SELECT * FROM tbl_doctor_hos_time WHERE doctor_id = '${id}'`);
        const dhdl = await DataFind(`SELECT * FROM tbl_doctor_hos_depart_list WHERE doctor_id = '${id}'`);
        
        if (dht == '' || dhdl == '') {
            for (let i = 0; i < hospital_list.length;){
                if (dht == '') {
                    if (await DataInsert(`tbl_doctor_hos_time`, `doctor_id, hospital_id, date_time_list, book_time_list`, 
                        `'${id}', '${hospital_list[i]}', '[]', '[]'`, req.hostname, req.protocol) == -1) {
                        
                        return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
                    }
                }
                    
                if (dht == '') {
                    for (let a = 0; a < department_list.length;) {
                        if (await DataInsert(`tbl_doctor_hos_depart_list`, `doctor_id, hospital_id, department_id, sub_title, image, client_visit_price, video_consult_price, show_type, status`, 
                            `'${id}', '${hospital_list[i]}', '${department_list[a]}', '', '', '0', '0', '0', '0'`, req.hostname, req.protocol) == -1) {
                            
                            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
                        }
                        a++;
                    }
                }
                i++;
            }
        }

        const udoc = await DataFind(`SELECT * FROM tbl_doctor_list WHERE id = '${id}'`);
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Signup Successful', status: 0, doctor_detail: udoc[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// ============= Login ================ //

router.post("/login", async(req, res)=>{
    try {
        const {ccode, phone, password} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["ccode", "phone", "password"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        let doc = [], dsc = 0, recep_status = 0, lty = 'lab_data', passc = '', rec = '';

        const general = await DataFind(`SELECT lab_active_status FROM tbl_general_settings`);

        if (general) {
            if (general[0].lab_active_status == 1) doc = await DataFind(`SELECT * FROM tbl_lab_list WHERE country_code = '${ccode}' AND phone = '${phone}'`);
        }

        if (doc == '') {
            const recep = await DataFind(`SELECT * FROM tbl_doctor_receptionist WHERE country_code = '${ccode}' AND phone = '${phone}'`);
            
            if (recep.length > 0) {
                rec = `id = '${recep[0].doctor_id}'`;
                passc = recep[0].password;
            } else rec = `country_code = '${ccode}' AND phone = '${phone}'`;

            doc = await DataFind(`SELECT * FROM tbl_doctor_list WHERE ${rec}`), recep_status = rec.startsWith("id") == true ? 1 : 0;
            
            if (doc != '') {
                dsc = await AllFunction.DoctorSignupCheck(doc[0]);
                passc = doc[0].password;
            }
            lty = 'doctor_detail';
        } else passc = doc[0].password;
        
        if(doc == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Mobile number not register!', st: lty == 'lab_data' ? 2 : 1, status: 1, recep_status, [lty]: doc.length > 0 ? doc[0] : doc  });
        if(doc[0].status != "1") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Account deactivated!', st: lty == 'lab_data' ? 2 : 1, status: dsc, recep_status, [lty]: doc.length > 0 ? doc[0] : doc });

        const hash = await bcrypt.compare(password, passc);
        if(!hash) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Password Not match!' });
        
        delete doc[0].latitude; delete doc[0].longitude; delete doc[0].wallet;

        if (dsc == 0) return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Login Successful', st: lty == 'lab_data' ? 2 : 1, status: dsc, recep_status, [lty]: doc.length > 0 ? doc[0] : doc });
        else return res.status(200).json({ ResponseCode: 200, Result:false, message: 'Please Complete signup!', st: lty == 'lab_data' ? 2 : 1, status: dsc, recep_status, [lty]: doc.length > 0 ? doc[0] : doc });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.post("/forgot_password", async(req, res)=>{
    try {
        const {ccode, phone, password} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["ccode", "phone", "password"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        let ud = [], tab_name = 'tbl_doctor_list';
        ud = await DataFind(`SELECT * FROM tbl_doctor_list WHERE country_code = '${ccode}' AND phone = '${phone}'`);
        if (ud == '') {
            ud = await DataFind(`SELECT * FROM tbl_lab_list WHERE country_code = '${ccode}' AND phone = '${phone}'`);
            tab_name = 'tbl_lab_list';
        }
        if (ud == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Mobile Number Not Found!'});

        const hash = await bcrypt.hash(password, 10)
        if (await DataUpdate(tab_name, `password = '${hash}'`, `id = '${ud[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Password change successful'});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get("/lab_status_check", async(req, res)=>{
    try {
        const general = await DataFind(`SELECT lab_active_status FROM tbl_general_settings`);

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Status Load Suucessful', lab_status: general ? general[0].lab_active_status : 0});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.post("/mobile_check", async(req, res)=>{
    try {
        const {ccode, phone, email} = req.body;

        let nmess = [], ud = [], ue = [];

        const general = await DataFind(`SELECT lab_active_status FROM tbl_general_settings`);
        
        const phoneQuery = async () => {
            if (ccode && phone) {
                ud = await DataFind(`SELECT phone FROM tbl_doctor_list WHERE country_code = '${ccode}' AND phone = '${phone}'
                                        UNION SELECT phone FROM tbl_doctor_receptionist WHERE country_code = '${ccode}' AND phone = '${phone}'
                                        UNION SELECT phone FROM tbl_admin WHERE country_code = '${ccode}' AND phone = '${phone}'`);

                if (general) {
                    if (!ud.length && general[0].lab_active_status == 1) {
                        ud = await DataFind(`SELECT * FROM tbl_lab_list WHERE country_code = '${ccode}' AND phone = '${phone}'`);
                    }
                }

                if (ud != '') nmess.push("Mobile Number");
            }
        };

        const emailQuery = async () => {
            if (email) {
                ue = await DataFind(`SELECT * FROM tbl_doctor_list WHERE email = '${email}'`);

                if (general) {
                    if (!ue.length && general[0].lab_active_status == 1) {
                        ue = await DataFind(`SELECT * FROM tbl_lab_list WHERE email = '${email}'`);
                    }
                }

                if (ue != '') nmess.push("Email");
            }
        };
        
        await Promise.all([phoneQuery(), emailQuery()]);
        
        return res.status(200).json({
            ResponseCode: 401,
            message: ud.length !== 0 || ue.length !== 0 ? `${nmess.join(" And ")} Already Registered!` : ``,
            lab_active_status: general ? general[0].lab_active_status : 0,
            Result: ccode && phone ? ud.length === 0 : false,
            email_result: email ? ue.length === 0 : false
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// ============= OTP Details ================ //

router.get("/otp_detail", async(req, res)=>{
    try {
        const gs = await DataFind(`SELECT * FROM tbl_general_settings`);

        let sms_type = ""

        if (gs != "") {
            if (gs[0].sms_type == "1") sms_type = "MSG91";
            else if (gs[0].sms_type == "2") sms_type = "Twilio";
            else sms_type = "No Auth";
        }

        res.status(200).json({ ResponseCode: 200, Result:true, message: sms_type});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/msg91", async(req, res)=>{
    try {
        const {ccode, phone} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["ccode", "phone"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const general_setting = await DataFind(`SELECT * FROM tbl_general_settings`);

        if (general_setting[0].msg_key != "" && general_setting[0].msg_token != "") {
            let otp_result = await AllFunction.otpGenerate(6), auth_key = general_setting[0].msg_key, template_id = general_setting[0].msg_token;
            
            let pho_no = ccode + phone;
            const options = {
                method: 'POST',
                url: 'https://control.msg91.com/api/v5/otp?template_id='+ template_id +'&mobile='+ pho_no +'&otp=' + otp_result,
                headers: {
                    accept: 'application/json',
                    'content-type': 'application/json',
                    authkey: auth_key
                },
                data: {Param1: 'value1'}
            };
        
            axios.request(options)
            .then(function (response) {
                console.log(response.data);
                return res.status(200).json({ ResponseCode: 200, Result:true, message: "Otp send successful", otp: otp_result });
            })
            .catch(function (error) {
                console.error(error);
                return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });
            });
        } else return res.status(200).json({ ResponseCode: 401, Result:false, message: "Data not found!" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/twilio", async(req, res)=>{
    try {
        const {ccode, phone} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["ccode", "phone"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const general_setting = await DataFind(`SELECT * FROM tbl_general_settings`);

        if (general_setting[0].twilio_sid != "" && general_setting[0].twilio_token != "") {
            let otp_result = await AllFunction.otpGenerate(6), accountSid = general_setting[0].twilio_sid, authToken = general_setting[0].twilio_token;
            const client = require('twilio')(accountSid, authToken);
        
            client.messages.create({
                body: 'Your '+ general_setting[0].title +' otp is '+ otp_result +'',
                from: general_setting[0].twilio_phoneno,
                to: ccode + phone
            }).then(message => {
                console.log(message.sid);
                res.status(200).json({ ResponseCode: 200, Result:true, message: "Otp Send successful", otp: otp_result });
            }).catch((error) => {
                console.log(error);
                res.status(200).json({ ResponseCode: 401, Result:false, message: `Something went wrong, ERROR :- ${error.message}` });
            });
        } else return res.status(200).json({ ResponseCode: 401, Result:false, message: "Data not found!" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============= Home ================ //

router.post('/home', async (req, res) => {
    try {
        const {id, recep_status} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "recep_status"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const doctor = await DataFind(`SELECT logo, name, wallet, verification_status FROM tbl_doctor_list WHERE id = '${id}' AND status = '1'`);
        if (doctor == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'User not found!' });

        const appointment = await DataFind(`SELECT COUNT(*) AS tot_appintment FROM tbl_booked_appointment WHERE doctor_id = '${id}'`);

        const gallery_data = await DataFind(`SELECT COUNT(*) AS tot_image FROM tbl_doctor_gallery WHERE doctor_id = '${id}'`);
        
        const department = await DataFind(`SELECT COUNT(*) AS tot_department FROM tbl_doctor_hos_depart_list WHERE doctor_id = '${id}' GROUP BY department_id`);

        const vitals_physical = await DataFind(`SELECT COUNT(*) AS tot_vital_physical FROM tbl_doctor_vitals_physical WHERE doctor_id = '${id}'`);

        const medicine_list = await DataFind(`SELECT COUNT(*) AS tot_medicine FROM tbl_doctor_medicine WHERE doctor_id = '${id}'`);

        const diagnosis_list = await DataFind(`SELECT COUNT(*) AS tot_diagnosis FROM tbl_doctor_diagnosis_test WHERE doctor_id = '${id}'`);
        
        const award = await DataFind(`SELECT COUNT(*) AS tot_award FROM tbl_doctor_award_achievement WHERE doctor_id = '${id}'`);

        const coupon_list = await DataFind(`SELECT COUNT(*) AS tot_coupon FROM tbl_coupon WHERE doctor_id = '${id}'`);
        
        const about_data = await DataFind(`SELECT * FROM tbl_about WHERE doctor_id = '${id}'`);
        let tot_about = 0;
        if (about_data != "") {
            const aboutheading = about_data[0].heading.split("&!");
            tot_about = aboutheading.length;
        }

        const review_list = await DataFind(`SELECT COUNT(*) AS tot_review FROM tbl_doctor_reviews WHERE doctor_id = '${id}'`);

        const faq_data = await DataFind(`SELECT COUNT(*) AS tot_faq FROM tbl_doctor_faq WHERE doctor_id = '${id}'`);

        const setting = await DataFind(`SELECT COUNT(*) AS tot_times FROM tbl_doctor_hos_time WHERE doctor_id = '${id}'`);
        
        const general_setting = await DataFind(`SELECT site_currency, one_app_id, one_app_id_react, google_map_key, agora_app_id FROM tbl_general_settings`);

        const tot_recep = await DataFind(`SELECT COUNT(*) AS tot_recep FROM tbl_doctor_receptionist WHERE doctor_id = '${id}'`);
        
        const check_time = await DataFind(`SELECT date_time_list FROM tbl_doctor_hos_time WHERE doctor_id = '${id}'`);
        
        let timecheck = 1
        for (const tc of check_time) {
            let jpd = typeof tc.date_time_list == "string" ? JSON.parse(tc.date_time_list) : tc.date_time_list ;
            if (jpd != '') timecheck = 0;
        }
        
        const dc = await DataFind(`SELECT CASE
                                        WHEN EXISTS (
                                            SELECT 1
                                            FROM tbl_doctor_hos_depart_list
                                            WHERE doctor_id = '${id}'
                                                AND sub_title <> '' 
                                                -- AND image <> '' 
                                                AND client_visit_price <> 0 
                                                AND video_consult_price <> 0
                                        ) 
                                        THEN 0 ELSE 1
                                    END AS result;`);
        
        // const dc = await DataFind(`SELECT sub_title, image, client_visit_price, video_consult_price FROM tbl_doctor_hos_depart_list WHERE doctor_id = '6'`);

        // const result = dc.some(item => 
        //     item.sub_title !== '' &&
        //     item.image !== '' &&
        //     item.client_visit_price !== 0 &&
        //     item.video_consult_price !== 0
        // ) ? 0 : 1;
        
        let data = [
            { field_name: "Book Services", tot_no: appointment[0].tot_appintment },
            { field_name: "Gallery", tot_no: gallery_data[0].tot_image},
            { field_name: "Services & Department", tot_no: department.length },
            { field_name: "Vitals & Physical", tot_no: vitals_physical[0].tot_vital_physical },
            { field_name: "Medicine", tot_no: medicine_list[0].tot_medicine },
            { field_name: "Diagnosis test", tot_no: diagnosis_list[0].tot_diagnosis },
            { field_name: "Award", tot_no: award[0].tot_award },
            { field_name: "Coupon", tot_no: coupon_list[0].tot_coupon },
            { field_name: "About", tot_no: tot_about },
            { field_name: "Review", tot_no: review_list[0].tot_review },
            { field_name: "Hospital Time", tot_no: setting[0].tot_times },
            { field_name: "FAQ", tot_no: faq_data[0].tot_faq },
            { field_name: "My Earning", tot_no: doctor[0].wallet },
            // { field_name: "Cash management", tot_no: tot_balance[0].tot_amount },
            { field_name: "Setting", tot_no: 4 }
        ];
        if (recep_status == 0) data.push({ field_name: "Receptionist", tot_no: tot_recep[0].tot_recep });

        delete doctor[0].wallet;
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', timecheck, deprtment_check: dc[0].result, general_currency:general_setting[0], 
            doctor:doctor[0], data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// ============= Gallery ================ //

router.post('/gallery_list', async (req, res) => {
    try {
        const {id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const gallery_list = await DataFind(`SELECT id, image FROM tbl_doctor_gallery where doctor_id = '${id}' ORDER BY id DESC`);

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', gallery_list });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

AllFunction.ImageUploadFolderCheck(`./public/uploads/gallery`);
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/gallery");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const upload = multer({storage : storage});

router.post('/add_gallery', upload.array('image'), async (req, res) => {
    try {
        const {id} = req.body;
        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        if (req.files) {
            for (let i = 0; i < req.files.length;){
                let file = "uploads/gallery/" + req.files[i].filename;

                if (await DataInsert(`tbl_doctor_gallery`, `doctor_id, image`, `'${id}', '${file}'`, req.hostname, req.protocol) == -1) {
                    return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
                }
                i++;
            }
            return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Gallery Add successful' });
        } else {
            return res.status(200).json({ ResponseCode: 200, Result:false, message: 'Image Not Found!' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/delete_gallery", async(req, res)=>{
    try {
        const {id, image_id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "image_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const gallery_data = await DataFind(`SELECT * FROM tbl_doctor_gallery where id = '${image_id}' AND doctor_id = '${id}'`);
        if (gallery_data == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data not found!' });
        
        await AllFunction.DeleteImage(gallery_data[0].image);

        if (await DataDelete(`tbl_doctor_gallery`, `id = '${image_id}' AND doctor_id = '${id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Image Delete successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// ============= Hospital & Department service ================ //

router.post('/services_list', async (req, res) => {
    try {
        const {id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const hospital_list = await DataFind(`SELECT dhd.hospital_id, COALESCE(hos.name, '') AS hospital_name
                                        FROM tbl_doctor_hos_depart_list AS dhd 
                                        LEFT JOIN tbl_hospital_list AS hos ON hos.id = dhd.hospital_id
                                        WHERE dhd.doctor_id = '${id}' GROUP BY dhd.hospital_id;`);

        let service_list = [];
        for (const val of hospital_list) {
            let serd = await DataFind(`SELECT hos_dep.id, hos_dep.hospital_id, hos_dep.department_id, hos_dep.sub_title, hos_dep.image, hos_dep.client_visit_price, 
                                        hos_dep.video_consult_price, hos_dep.show_type, hos_dep.status, COALESCE(dep.name) AS depart_name
                                        FROM tbl_doctor_hos_depart_list AS hos_dep 
                                        LEFT JOIN tbl_department_list AS dep on dep.id =  hos_dep.department_id
                                        where doctor_id = '${id}' AND hospital_id = '${val.hospital_id}' `);
            
            service_list.push({ hospital_name: val.hospital_name, subservice: serd });
        };
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', hospital_list, service_list });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

AllFunction.ImageUploadFolderCheck(`./public/uploads/dep_subservice`);
const storage1 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/dep_subservice");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const serviceimg = multer({storage : storage1});

router.post('/edit_services', serviceimg.single("image"), async (req, res) => {
    try {
        const {id, service_id, hospital_id, subservice, client_vis_price, video_con_price, show_type, status} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "service_id", "hospital_id", "subservice", "client_vis_price", "video_con_price", "show_type", "status"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const ser_data = await DataFind(`SELECT * FROM tbl_doctor_hos_depart_list where id = '${service_id}' AND doctor_id = '${id}' AND hospital_id = '${hospital_id}'`);
        if (ser_data == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data not found!' });

        let ImageUrl  = ''
        if (req.file) {
            if (ser_data[0].image != '') await AllFunction.DeleteImage(ser_data[0].image);
            ImageUrl = `uploads/dep_subservice/${req.file.filename}`
        } else ImageUrl = ser_data[0].image;

        if (await DataUpdate(`tbl_doctor_hos_depart_list`, `sub_title = '${subservice}', image = '${ImageUrl}', client_visit_price = '${client_vis_price}', 
            video_consult_price = '${video_con_price}', show_type = '${show_type}', status = '${status}'`, `id = '${ser_data[0].id}'`, req.hostname, req.protocol) == -1) {
            
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Service update successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// ============= Vitials & Physical ================ //

router.post('/vit_phy_list', async (req, res) => {
    try {
        const {id} = req.body;
        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const vit_phy = await DataFind(`SELECT * FROM tbl_doctor_vitals_physical WHERE doctor_id = '${id}' ORDER BY id DESC`);
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', vit_phy });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/add_vit_phy', async (req, res) => {
    try {
        const {id, title, status} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "title", "status"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const estitele = mysql.escape(title);
        
        if (await DataInsert(`tbl_doctor_vitals_physical`, `doctor_id, title, status`, `'${id}', ${estitele}, '${status}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Vitials and Physical Information Add successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/edit_vit_phy', async (req, res) => {
    try {
        const {id, vitphy_id, title, status} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "vitphy_id", "title", "status"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const vit_phy = await DataFind(`SELECT * FROM tbl_doctor_vitals_physical WHERE id = '${vitphy_id}' AND doctor_id = '${id}' ORDER BY id DESC`);
        if (vit_phy == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data not found!' });

        const estitele = mysql.escape(title);
        
        if (await DataUpdate(`tbl_doctor_vitals_physical`, `title = ${estitele}, status = '${status}'`, `id = '${vit_phy[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Vitials and Physical Information Update successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/delete_vit_phy', async (req, res) => {
    try {
        const {id, vitphy_id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "vitphy_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const vit_phy = await DataFind(`SELECT * FROM tbl_doctor_vitals_physical WHERE id = '${vitphy_id}' AND doctor_id = '${id}' ORDER BY id DESC`);
        if (vit_phy == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data not found!' });

        if (await DataDelete(`tbl_doctor_vitals_physical`, `id = '${vitphy_id}' AND doctor_id = '${id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Vitials and Physical Information Delete successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// ============= Medicine ================ //

router.post('/medicine_list', async (req, res) => {
    try {
        const {id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const medicine = await DataFind(`SELECT * FROM tbl_doctor_medicine WHERE doctor_id = '${id}' ORDER BY id DESC`);
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', medicine });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/add_medicine', async (req, res) => {
    try {
        const {id, name, status} = req.body;
    
        const missingField = await AllFunction.BodyDataCheck(["id", "name", "status"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });  

        const estitele = mysql.escape(name);
        
        if (await DataInsert(`tbl_doctor_medicine`, `doctor_id, name, status`, `'${id}', ${estitele}, '${status}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Medicine Add successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/edit_medicine', async (req, res) => {
    try {
        const {id, medicine_id, name, status} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "medicine_id", "name", "status"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const medicine = await DataFind(`SELECT * FROM tbl_doctor_medicine WHERE id = '${medicine_id}' AND doctor_id = '${id}' ORDER BY id DESC`);
        if (medicine == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data not found!' });

        const estitele = mysql.escape(name);
        
        if (await DataUpdate(`tbl_doctor_medicine`, `name = ${estitele}, status = '${status}'`, `id = '${medicine[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Medicine Update successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/delete_medicine', async (req, res) => {
    try {
        const {id, medicine_id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "medicine_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const medicine = await DataFind(`SELECT * FROM tbl_doctor_medicine WHERE id = '${medicine_id}' AND doctor_id = '${id}' ORDER BY id DESC`);
        if (medicine == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data not found!' });

        if (await DataDelete(`tbl_doctor_medicine`, `id = '${medicine_id}' AND doctor_id = '${id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Medicine Delete successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// ============= Diagnosis ================ //

router.post('/diagnosis_list', async (req, res) => {
    try {
        const {id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const diagnosis_list = await DataFind(`SELECT * FROM tbl_doctor_diagnosis_test WHERE doctor_id = '${id}' ORDER BY id DESC`);
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', diagnosis_list });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/add_diagnosis', async (req, res) => {
    try {
        const {id, name, description, status} = req.body;
    
        const missingField = await AllFunction.BodyDataCheck(["id", "name", "description", "status"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const estitele = mysql.escape(name), esdes = mysql.escape(description);
        
        if (await DataInsert(`tbl_doctor_diagnosis_test`, `doctor_id, name, description, status`, `'${id}', ${estitele}, ${esdes}, '${status}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Diagnosis Add successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/edit_diagnosis', async (req, res) => {
    try {
        const {id, diagnosis_id, name, description, status} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "diagnosis_id", "name", "description", "status"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const diagnosis = await DataFind(`SELECT * FROM tbl_doctor_diagnosis_test WHERE id = '${diagnosis_id}' AND doctor_id = '${id}' ORDER BY id DESC`);
        if (diagnosis == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data not found!' });

        const estitele = mysql.escape(name), esdes = mysql.escape(description);
        
        if (await DataUpdate(`tbl_doctor_diagnosis_test`, `name = ${estitele}, description = ${esdes}, status = '${status}'`, `id = '${diagnosis[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Diagnosis Update successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/delete_diagnosis', async (req, res) => {
    try {
        const {id, diagnosis_id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "diagnosis_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const diagnosis = await DataFind(`SELECT * FROM tbl_doctor_diagnosis_test WHERE id = '${diagnosis_id}' AND doctor_id = '${id}' ORDER BY id DESC`);
        if (diagnosis == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data not found!' });

        if (await DataDelete(`tbl_doctor_diagnosis_test`, `id = '${diagnosis_id}' AND doctor_id = '${id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Diagnosis Delete successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// ============= Award and Achievement ================ //

router.post('/award_achievement_list', async (req, res) => {
    try {
        const {id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const award_list = await DataFind(`SELECT * FROM tbl_doctor_award_achievement where doctor_id = '${id}' ORDER BY id DESC`);
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', award_list });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

AllFunction.ImageUploadFolderCheck(`./public/uploads/doc_award`);
const storage2 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/doc_award");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const pet_image = multer({storage : storage2});

router.post('/add_award_achievement', pet_image.single("image"), async (req, res) => {
    try {
        const {id, title, status} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "title", "status"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        if(!req.file) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Please Uplaod Image' });
        
        const imageUrl = req.file ? "uploads/doc_award/" + req.file.filename : null, estitle = mysql.escape(title);
        
        if (await DataInsert(`tbl_doctor_award_achievement`, `doctor_id, image, title, status`,
            `'${id}', '${imageUrl}', ${estitle}, '${status}'`, req.hostname, req.protocol) == -1) {
        
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }
    
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Award and Achievement add successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/edit_award_achievement', pet_image.single("image"), async (req, res) => {
    try {
        const {id, award_id, title, status} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "award_id", "title", "status"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const award = await DataFind(`SELECT * FROM tbl_doctor_award_achievement where id = '${award_id}' AND doctor_id = '${id}' ORDER BY id DESC`);
        if(award == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data not found!' }); 

        let imageUrl = '', estitle = mysql.escape(title);
        if (req.file) {
            await AllFunction.DeleteImage(award[0].image);
            imageUrl = "uploads/doc_award/" + req.file.filename
        } else imageUrl = award[0].image
        
        if (await DataUpdate(`tbl_doctor_award_achievement`, `image = '${imageUrl}', title = ${estitle}, status = '${status}'`,
            `id = '${award_id}' AND doctor_id = '${id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }
    
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Award and Achievement edit successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/delete_award_achievement', async (req, res) => {
    try {
        const {id, award_id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "award_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const award = await DataFind(`SELECT * FROM tbl_doctor_award_achievement where id = '${award_id}' AND doctor_id = '${id}' ORDER BY id DESC`);
        if(award == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data not found!' }); 

        await AllFunction.DeleteImage(award[0].image);
        if (await DataDelete(`tbl_doctor_award_achievement`, `id = '${award_id}' AND doctor_id = '${id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }
    
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Award and Achievement Delete successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// ============= Coupon ================ //

router.post('/coupon_list', async (req, res) => {
    try {
        const {id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const coupon_list = await DataFind(`SELECT * FROM tbl_coupon WHERE doctor_id = '${id}' ORDER BY id DESC`);
        
        coupon_list.map(val => {
            val.start_date = new Date(val.start_date).toISOString().split("T")[0];
            val.end_date = new Date(val.end_date).toISOString().split("T")[0];
        })

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', coupon_list });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

function isValidDateFormat(dateString) {
    let dateFormatRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (dateFormatRegex.test(dateString)) {
        if (new Date(dateString) != "Invalid Date") {
            return true;
        }
    }
    return false;
}

router.post('/add_coupon', async (req, res) => {
    try {
        const {id, title, sub_title, code, start_date, end_date, min_amount, discount_amount} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "title", "sub_title", "code", "start_date", "end_date", "min_amount", "discount_amount"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        if (isValidDateFormat(start_date) === false || isValidDateFormat(end_date) === false) return res.status(200).json({ message: 'Invalid Date Format', status:false});
            
        if (new Date().toISOString().split("T")[0] <= start_date && start_date < end_date) {
            
            if (await DataInsert(`tbl_coupon`, `doctor_id, title, sub_title, code, start_date, end_date, min_amount, discount_amount`,
                `'${id}', '${title}', '${sub_title}', '${code}', '${start_date}', '${end_date}', '${min_amount}', '${discount_amount}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }
                
            return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Coupon Add successful' });
        } else return res.status(200).json({ ResponseCode: 401, Result:false, message: 'The provided date is past' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/edit_coupon', async (req, res) => {
    try {
        const {id, coupon_id, title, sub_title, code, start_date, end_date, min_amount, discount_amount} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "title", "sub_title", "code", "start_date", "end_date", "min_amount", "discount_amount"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const coupon = await DataFind(`SELECT * FROM tbl_coupon WHERE id = '${coupon_id}' AND doctor_id = '${id}' ORDER BY id DESC`);
        if (coupon == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data not found!' });

        if (isValidDateFormat(start_date) === false || isValidDateFormat(end_date) === false) return res.status(200).json({ message: 'Invalid Date Format', status:false});
            
        if (new Date().toISOString().split("T")[0] <= start_date && start_date < end_date) {
                
            if (await DataUpdate(`tbl_coupon`, `title = '${title}', sub_title = '${sub_title}', code = '${code}', start_date = '${start_date}', end_date = '${end_date}', 
                min_amount = '${min_amount}', discount_amount = '${discount_amount}'`, `id = '${coupon_id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }

            return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Coupon edit successful' });
        } else return res.status(200).json({ ResponseCode: 401, Result:false, message: 'The provided date is past' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/delete_coupon', async (req, res) => {
    try {
        const {coupon_id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["coupon_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        if (await DataDelete(`tbl_coupon`, `id = '${coupon_id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }
    
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Coupon delete successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// ============= About ================ //

router.post('/about_list', async (req, res) => {
    try {
        const {id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        let head_des = [], imglist = [];
        const folderPath = path.resolve(__dirname, '../public/uploads/about');
        fs.readdirSync(folderPath).forEach(file => {
            imglist.push({imgpath : "uploads/about/" + file, imgname : file});
        });

        const about_data = await DataFind(`SELECT * FROM tbl_about WHERE doctor_id = '${id}'`);
        if (about_data == '') return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data not found!', imglist, head_des: [] });
        
        const aboutid = about_data[0].about_id.split("&!");
        const aboutheading = about_data[0].heading.split("&!");
        const aboutdes = about_data[0].description.split("&!");
        const abouttitle = about_data[0].title.split("&!");
        const abouticon = about_data[0].icon.split("&&!");
        const aboutsubtitle = about_data[0].sub_title.split("&&!");
        
        aboutheading.forEach((heading, index) => {
            let dataicon = abouticon[index].split("&!");
            let datasub = aboutsubtitle[index].split("&!");
            
            const about = [];
            for (let i = 0; i < dataicon.length;){
                about.push({ icon: dataicon[i], subtitle: datasub[i] });
                i++;
            }
    
            head_des.push({ id: aboutid[index], head: heading, description: aboutdes[index], title: abouttitle[index], about: about });
        });
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', imglist, head_des });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

function aboutimg() {
    const folderPath = path.resolve(__dirname, '../public/uploads/about');
    let imagel = fs.readdirSync(folderPath)[0];
    return imagel;
}

router.post('/add_about', async (req, res) => {
    try {
        const {id, head, description, title, list} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "head", "description", "title", "list"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const about_data = await DataFind(`SELECT * FROM tbl_about WHERE doctor_id = '${id}'`);
                
        if (about_data != "") {
            const aboutid = about_data[0].about_id.split("&!");
            let idlen = parseFloat(aboutid.length) + 1;
            let aid = about_data[0].about_id + '&!' + idlen;
        
            const aboutheading = about_data[0].heading + '&!' + head, aboutdes = about_data[0].description + '&!' + description, abouttitle = about_data[0].title + '&!' + title;
        
            let abouticon = about_data[0].icon + '&&!', aboutsubtitle = about_data[0].sub_title + '&&!';
        
            for (let i = 0; i < list.length;){
                
                if (list[i].icon != "" && list[i].subtitle != "") {
        
                    let iconp = "", ilist = list[i].icon;
                    if (ilist.includes("uploads/about/") === true) iconp = ilist;
                    else iconp = "uploads/about/" + ilist;
        
                    let defualticon = iconp == "" ? "uploads/about/" + aboutimg() : iconp;
                    abouticon += i == 0 ? defualticon : '&!' + defualticon;
                    aboutsubtitle += i == 0 ? list[i].subtitle : '&!' + list[i].subtitle;
                }
                i++;
            }
            let esheading = mysql.escape(aboutheading), esdes = mysql.escape(aboutdes), estitle = mysql.escape(abouttitle), essubtitle = mysql.escape(aboutsubtitle);
        
            if (await DataUpdate(`tbl_about`, `about_id = '${aid}', title = ${estitle}, icon = '${abouticon}', sub_title = ${essubtitle}, heading = ${esheading}, description = ${esdes}`, 
                `doctor_id = '${id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }
            
        } else {
            let aicon = "", asubtitle = "";
            for (let a = 0; a < list.length;){
        
                if (list[a].icon != "" && list[a].subtitle != "") {
        
                    let iconp = "", ilist = list[a].icon;
                    if (ilist.includes("uploads/about/") === true) iconp = ilist;  
                    else iconp = "uploads/about/" + ilist;
            
                    let ic = list[a].icon == "" ? "uploads/about/" + aboutimg() : list[a].icon;
                    aicon += a == 0 ? ic : '&!' + ic;
                    asubtitle += a == 0 ? list[a].subtitle : '&!' + list[a].subtitle;
                    
                }
                a++;
            }
                
            let esheading = mysql.escape(head), esdes = mysql.escape(description), estitle = mysql.escape(title), essubtitle = mysql.escape(asubtitle);
                
            if (await DataInsert(`tbl_about`, `doctor_id, about_id, title, icon, sub_title, heading, description`,
                `'${id}', '1', ${estitle}, '${aicon}', ${essubtitle}, ${esheading}, ${esdes}`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }
        }
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'About Add and Update successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/edit_about', async (req, res) => {
    try {
        const {id, about_id, head, description, title, list} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "head", "description", "title", "list"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const about_data = await DataFind(`SELECT * FROM tbl_about WHERE doctor_id = '${id}'`);
        
        if (about_data != "") {
            const aboutid = about_data[0].about_id.split("&!"), aboutheading = about_data[0].heading.split("&!"), aboutdes = about_data[0].description.split("&!");
            const abouttitle = about_data[0].title.split("&!"), abouticon = about_data[0].icon.split("&&!"), aboutsubtitle = about_data[0].sub_title.split("&&!");
            
            if (about_id != "") {
                
                for (let i = 0; i < aboutid.length;){
                    let icon = "", subtitle = "";
                    if (aboutid[i] == about_id) {
                        aboutheading[i] = head; aboutdes[i] = description; abouttitle[i] = title;
                        
                        for (let a = 0; a < list.length;){
                            if (list[a].icon != "" && list[a].subtitle != "") {
    
                                let iconp = "", ilist = list[a].icon;
                                if (ilist.includes("uploads/about/") === true) iconp = ilist;
                                else iconp = "uploads/about/" + ilist;
    
                                let ic = iconp == "" ? "uploads/about/" + aboutimg() : iconp;
                                icon += icon == "" ? ic : '&!' + ic;
                                subtitle += subtitle == "" ? list[a].subtitle : '&!' + list[a].subtitle;
                            }
                            a++;
                        }
                        abouticon[i] = icon; aboutsubtitle[i] = subtitle;
                    }
                    i++;
                }
            }
            
            let nid = aboutid.join("&!"), nheading = aboutheading.join("&!"), ndesc = aboutdes.join("&!"), ntitle = abouttitle.join("&!"), nicon = abouticon.join("&&!"), 
                nsubtitle = aboutsubtitle.join("&&!");
            
            let esheading = mysql.escape(nheading), esdes = mysql.escape(ndesc), estitle = mysql.escape(ntitle), essubtitle = mysql.escape(nsubtitle);
            
            if (await DataUpdate(`tbl_about`, `about_id = '${nid}', title = ${estitle}, icon = '${nicon}', sub_title = ${essubtitle}, heading = ${esheading}, description = ${esdes}`,
                `doctor_id = '${id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }
            
            return res.status(200).json({ ResponseCode: 200, Result:true, message: 'About Update successful' });
        } else {
            return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data Not Found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/delete_about', async (req, res) => {
    try {
        const {id, delete_id} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "delete_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const about_data = await DataFind(`SELECT * FROM tbl_about WHERE doctor_id = '${id}'`);
        
        if (about_data != "") {
            const aboutid = about_data[0].about_id.split("&!");
            const aboutheading = about_data[0].heading.split("&!");
            const aboutdes = about_data[0].description.split("&!");
            const abouttitle = about_data[0].title.split("&!");
            const abouticon = about_data[0].icon.split("&&!");
            const aboutsubtitle = about_data[0].sub_title.split("&&!");
            
            for (let a = 0; a < aboutid.length;){
                if (aboutid[a] == delete_id) {
                    aboutid.splice(a, 1);
                    aboutheading.splice(a, 1);
                    aboutdes.splice(a, 1);
                    abouttitle.splice(a, 1);
                    abouticon.splice(a, 1);
                    aboutsubtitle.splice(a, 1);
                }
                a++;
            }
            
            let nid = aboutid.join("&!"), nheading = aboutheading.join("&!"), ndesc = aboutdes.join("&!"), ntitle = abouttitle.join("&!"), nicon = abouticon.join("&&!"), nsubtitle = aboutsubtitle.join("&&!");
    
            let esheading = mysql.escape(nheading), esdes = mysql.escape(ndesc), estitle = mysql.escape(ntitle), essubtitle = mysql.escape(nsubtitle);
            
            if (await DataUpdate(`tbl_about`, `about_id = '${nid}', title = ${estitle}, icon = '${nicon}', sub_title = ${essubtitle}, heading = ${esheading}, description = ${esdes}`,
                `doctor_id = '${id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }
    
            return res.status(200).json({ ResponseCode: 200, Result:true, message: 'About Delete successful' });
        } else {
            return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data Not Found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// ============= Review list ================ //

router.post('/review_list', async (req, res) => {
    try {
        const {id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const review_list = await DataFind(`SELECT dr.date, dr.review, dr.star_no, COALESCE(hos.name, '') AS hospital_name, COALESCE(cus.name, '') AS cus_name
                                            FROM tbl_doctor_reviews AS dr 
                                            LEFT JOIN tbl_customer AS cus ON cus.id = dr.customer_id
                                            LEFT JOIN tbl_hospital_list AS hos ON hos.id = dr.hospital_id
                                            WHERE dr.doctor_id = '${id}' ORDER BY dr.id DESC`);
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', review_list });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// ============= FAQ ================ //

router.post('/faq', async (req, res) => {
    try {
        const {id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const faq_data = await DataFind(`SELECT * FROM tbl_doctor_faq WHERE doctor_id = '${id}' ORDER BY id DESC`);
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', faq_data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/add_faq', async (req, res) => {
    try {
        const {id, title, description} = req.body;
    
        const missingField = await AllFunction.BodyDataCheck(["id", "title", "description"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const faq_faq_title = mysql.escape(title), faq_faq_des = mysql.escape(description);
    
        if (await DataInsert(`tbl_doctor_faq`, `doctor_id, title, description`, `'${id}', ${faq_faq_title}, ${faq_faq_des}`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'FAQ Add successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/edit_faq', async (req, res) => {
    try {
        const {id, faq_id, title, description} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "faq_id", "title", "description"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const faq_data = await DataFind(`SELECT * FROM tbl_doctor_faq WHERE id = '${faq_id}' AND doctor_id = '${id}' ORDER BY id DESC`);
        if (faq_data == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data not found!' });

        const faq_faq_title = mysql.escape(title), faq_faq_des = mysql.escape(description);
        
        if (await DataUpdate(`tbl_doctor_faq`, `title = ${faq_faq_title}, description = ${faq_faq_des}`, `id = '${faq_id}' AND doctor_id = '${id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'FAQ Update successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/delete_faq', async (req, res) => {
    try {
        const {id, faq_id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "faq_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        if (await DataDelete(`tbl_doctor_faq`, `id = '${faq_id}' AND doctor_id = '${id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'FAQ Delete successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





// ============= Time ================ //

router.post('/time', async (req, res) => {
    try {
        const {id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const dhd_list = await DataFind(`SELECT dhd.hospital_id, COALESCE(hos.name, '') AS hospital_name
                                        FROM tbl_doctor_hos_depart_list AS dhd 
                                        LEFT JOIN tbl_hospital_list AS hos ON hos.id = dhd.hospital_id
                                        WHERE dhd.doctor_id = '${id}' 
                                        GROUP BY dhd.hospital_id;`);

        if (dhd_list == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data not found!' });
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', hospital_list: dhd_list, day_list : await AllFunction.AllDayList});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/another_day_time', async (req, res) => {
    try {
        const {id, hospital_id, day} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "hospital_id", "day"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const doctor = await DataFind(`SELECT id, per_patient_time FROM tbl_doctor_list where id = '${id}'`);

        const dhd_list = await DataFind(`SELECT CAST(hos.id AS CHAR) AS hospital_id, COALESCE(hos.name, '') AS hospital_name, 
                                        dht.date_time_list, dht.book_time_list
                                        FROM tbl_doctor_hos_time AS dht
                                        LEFT JOIN tbl_hospital_list AS hos ON hos.id = dht.hospital_id
                                        WHERE dht.doctor_id = '${id}' `);

        if (dhd_list == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data not found!' });
        dhd_list[0].date_time_list = typeof dhd_list[0].date_time_list == "string" ? JSON.parse(dhd_list[0].date_time_list) : dhd_list[0].date_time_list;
        dhd_list[0].book_time_list = typeof dhd_list[0].book_time_list == "string" ? JSON.parse(dhd_list[0].book_time_list) : dhd_list[0].book_time_list;

        const time_data = await DataFind(`SELECT * FROM tbl_doctor_hos_time where doctor_id = '${id}' AND hospital_id = '${hospital_id}'`);
        
        doctor[0].per_patient_time = doctor[0].per_patient_time != 0 && doctor[0].per_patient_time != 'null' && doctor[0].per_patient_time < 0 ? doctor[0].per_patient_time : 20;
        
        let { morning, afternoon, evening } = await AllFunction.generateAndSplitTimeSlots(doctor[0].per_patient_time);

        const ndatelist = await AllFunction.TimeDurationWebSlot(dhd_list, hospital_id, time_data, morning, afternoon, evening, day);
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', day: day,
            Morning: ndatelist[0][day]["Morning"], Afternoon: ndatelist[0][day]["Afternoon"], Evening: ndatelist[0][day]["Evening"]});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.post('/update_time', async (req, res) => {
    try {
        const {id, hospital_id, day, Morning, Afternoon, Evening} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "hospital_id", "day"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const dtd = await DataFind(`SELECT id, hospital_id, date_time_list FROM tbl_doctor_hos_time where doctor_id = '${id}' AND hospital_id = '${hospital_id}'`);
        if(dtd == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data not found!' });
        dtd[0].date_time_list = typeof dtd[0].date_time_list == "string" ? JSON.parse(dtd[0].date_time_list) : dtd[0].date_time_list;

        const oth_dtd = await DataFind(`SELECT id, hospital_id, date_time_list FROM tbl_doctor_hos_time where doctor_id = '${id}' AND hospital_id != '${hospital_id}'`);
        
        let check = 0
        if (oth_dtd != '') {
            oth_dtd[0].date_time_list = typeof oth_dtd[0].date_time_list == "string" ? JSON.parse(oth_dtd[0].date_time_list) : oth_dtd[0].date_time_list;
            for (const d of oth_dtd) {
                
                if (d.date_time_list != '') {
                    let cd = d.date_time_list.find(val => val[day]);
                    if (cd) {
                        const fc = cd[day].Morning.filter(ftime => Morning.includes(ftime));
                        const sc = cd[day].Afternoon.filter(stime => Afternoon.includes(stime));
                        const tc = cd[day].Evening.filter(ttime => Evening.includes(ttime));
                        
                        if (fc != '' || sc != '' || tc != '') check++
                    }
                }
            }
        }
        
        if (check > 0) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Provided date already registered!' });

        let fdate = dtd[0].date_time_list.findIndex(val => val[day]) 
        
        if (dtd[0].date_time_list != '' && fdate != -1) {
            
            if (Morning.length > 0 || Afternoon.length > 0 || Evening.length > 0) {
                dtd[0].date_time_list[fdate][day].Morning = Morning;
                dtd[0].date_time_list[fdate][day].Afternoon = Afternoon;
                dtd[0].date_time_list[fdate][day].Evening = Evening;
            } else {
                if (dtd[0].date_time_list[fdate][day]) {
                    dtd[0].date_time_list.splice(fdate, 1);
                }
            }

        } else {
            
            dtd[0].date_time_list.push({
                [day]: {
                    "Morning": Morning,
                    "Afternoon": Afternoon,
                    "Evening": Evening
                }
            });
        }

        if (await DataUpdate(`tbl_doctor_hos_time`, `date_time_list = '${JSON.stringify(dtd[0].date_time_list)}'`, `id = '${dtd[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Time Update successful'});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============= Setting ================ //

router.post('/setting_detail', async (req, res) => {
    try {
        const {id} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const setting = await DataFind(`SELECT doctor_id, sign_image, extra_patient_charge, defaultm FROM tbl_doctor_setting where doctor_id = '${id}'`);
        const doctor = await DataFind(`SELECT per_patient_time FROM tbl_doctor_list where id = '${id}'`);
        if (setting == '' || doctor == '') return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data not found!', setting:
            {
                "doctor_id": "",
                "sign_image": "",
                "extra_patient_charge": 0,
                "defaultm": "",
                "per_patient_time": 0
            }
        });
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', setting: {...setting[0], ...doctor[0]}});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

AllFunction.ImageUploadFolderCheck(`./public/uploads/doctor_sign`);
const storage3 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/doctor_sign");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const doc_sign = multer({storage : storage3});

router.post('/setting', doc_sign.single("sign_image"), async (req, res) => {
    try {
        const {id, extra_patient_charge, defaultm, per_patient_time} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "extra_patient_charge", "defaultm", "per_patient_time"], req.body);
        if (missingField.status == false || Number(extra_patient_charge) <= 0 || Number(per_patient_time) <= 0) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        let setting = [], doctor = [];

        setting = await DataFind(`SELECT doctor_id, sign_image, extra_patient_charge, defaultm FROM tbl_doctor_setting where doctor_id = '${id}'`);
        doctor = await DataFind(`SELECT per_patient_time FROM tbl_doctor_list where id = '${id}'`);
        
        let imageUrl = '';
        if (req.file) {
            if (setting[0].sign_image != '') await AllFunction.DeleteImage(setting[0].sign_image);
            imageUrl = `uploads/doctor_sign/${req.file.filename}`;
        } else imageUrl = setting[0].sign_image;

        if (setting == "") {
            
            if (await DataInsert(`tbl_doctor_setting`, `doctor_id, sign_image, extra_patient_charge, defaultm`, 
                `'${id}', '${imageUrl}', '${extra_patient_charge}', '${defaultm}'`, req.hostname, req.protocol) == -1) {
        
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }
        } else {
            
            if (await DataUpdate(`tbl_doctor_setting`, `sign_image = '${imageUrl}', extra_patient_charge = '${extra_patient_charge}', defaultm = '${defaultm}'`, 
                `doctor_id = '${id}'`, req.hostname, req.protocol) == -1) {
                
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }
        }

        let per_pat_time = 0;
        if (per_patient_time <= 0 || isNaN(per_patient_time)) per_pat_time = Number(doctor[0].per_patient_time);
        else per_pat_time = Number(per_patient_time);

        if (await DataUpdate(`tbl_doctor_list`, `per_patient_time = '${per_pat_time}'`, `id = '${id}'`, req.hostname, req.protocol) == -1) {
            
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }
        
        setting = await DataFind(`SELECT doctor_id, sign_image, extra_patient_charge, defaultm FROM tbl_doctor_setting where doctor_id = '${id}'`);
        doctor = await DataFind(`SELECT per_patient_time FROM tbl_doctor_list where id = '${id}'`);

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Setting load successful', setting: {...setting[0], ...doctor[0]}});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// ============= Appointment list ================ //

router.post('/appointment_list', async (req, res) => {
    try {
        const {id} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const appoint_list = await DataFind(`SELECT bap.id, COALESCE(cus.id, 0) AS c_id, COALESCE(cus.name, '') AS cus_name, COALESCE(cus.email, '') AS cus_email,
                                                COALESCE(cus.country_code) AS country_code, COALESCE(cus.phone) AS phone, COALESCE(dep.name, '') AS depart_name,
                                                bap.book_date, bap.appointment_date, bap.appointment_time, bap.tot_price, bap.show_type,
                                                CASE 
                                                    WHEN bap.status IN (1,2) THEN 'pending'
                                                    WHEN bap.status IN (3,4,5) THEN 'complete'
                                                END AS status_type
                                                FROM tbl_booked_appointment AS bap
                                                LEFT JOIN tbl_customer AS cus ON cus.id = bap.customer_id
                                                LEFT JOIN tbl_department_list AS dep ON dep.id = bap.department_id
                                                WHERE bap.doctor_id = '${id}';`);

        const forma_app_list = appoint_list.map(val => ({
            ...val,
            book_date: new Date(val.book_date).toLocaleString('en-US', {
                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone 
            })
        }));

        const pending_appoint_list = [...forma_app_list].filter(val => val.status_type === 'pending').reverse();
        const complete_appoint_list = [...forma_app_list].filter(val => val.status_type === 'complete').reverse();

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Setting load successful', pending_appoint_list, complete_appoint_list});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/appointment_detail', async (req, res) => {
    try {
        const {id, appointment_id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "appointment_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const appoint = await DataFind(`SELECT boap.id, boap.customer_id, boap.doctor_id, boap.hospital_id, boap.department_id, boap.sub_depar_id, boap.status, boap.book_date, 
                                        boap.appointment_date, boap.appointment_time, boap.date_type, boap.family_mem_id, boap.show_type, boap.show_type_price, boap.tot_price,
                                        boap.paid_amount, boap.additional_price, boap.coupon_id, boap.coupon_amount, boap.doctor_commission, boap.site_commisiion, 
                                        boap.wallet_amount, 0 AS online_amount, 0 AS cash_amount,
                                        boap.payment_id, COALESCE(pd.name, '') AS payment_name, COALESCE(pd.image, '') AS payment_image, boap.additional_note,
                                        CASE WHEN JSON_LENGTH(boap.vitals_physical) = 0 THEN 0 ELSE 1 END AS vitals_physical,
                                        CASE WHEN JSON_LENGTH(boap.drugs_prescription) = 0 THEN 0 ELSE 1 END AS drugs_prescription,
                                        CASE WHEN JSON_LENGTH(boap.diagnosis_test) = 0 THEN 0 ELSE 1 END AS diagnosis_test, 0 AS timecount
                                        FROM tbl_booked_appointment AS boap
                                        LEFT JOIN tbl_payment_detail AS pd ON pd.id = boap.payment_id
                                        WHERE boap.id = '${appointment_id}' AND boap.doctor_id = '${id}'`);

        if (appoint == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Appointment not found!' });

        const date = new Date(appoint[0].book_date);
        const formattedDate = date.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
        appoint[0].book_date = formattedDate;
        
        if (appoint[0].payment_name != 'Cash') appoint[0].online_amount = Number((appoint[0].tot_price - appoint[0].wallet_amount).toFixed(2));
        else appoint[0].online_amount = 0;

        if (appoint[0].payment_name == 'Cash') appoint[0].cash_amount = Number((appoint[0].tot_price - appoint[0].paid_amount).toFixed(2));

        let timecount = await AllFunction.TwoTimeDiference(new Date(`${appoint[0].appointment_date} ${appoint[0].appointment_time}`).toISOString(), new Date().toISOString());
        
        if (timecount.hour < 0 || timecount.minute < 0 || timecount.second < 0) appoint[0].timecount = 0
        else appoint[0].timecount = Number(timecount.hour) * 60 * 60 + Number(timecount.minute) * 60 + Number(timecount.second);
            
        const customer = await DataFind(`SELECT id, name, email, country_code, phone
                                        FROM tbl_customer
                                        WHERE id = '${appoint[0].customer_id}' AND status = '1'`);

        const sebservice = await DataFind(`SELECT dhd.id, COALESCE(dl.image) AS depart_image, COALESCE(dl.name, '') AS department_name, dhd.sub_title, dhd.image, dhd.client_visit_price, 
                                            dhd.video_consult_price, dhd.show_type
                                            FROM tbl_doctor_hos_depart_list AS dhd
                                            LEFT JOIN tbl_department_list AS dl ON dl.id = dhd.department_id
                                            WHERE dhd.id = '${appoint[0].sub_depar_id}' AND dhd.sub_title != '' AND dhd.status = '1' ORDER BY id DESC`);
        
        const hospital = await DataFind(`SELECT id, image, name, email, country_code, phone, address FROM tbl_hospital_list WHERE id = '${appoint[0].hospital_id}' AND status = '1';`);
        
        if (hospital != '') hospital[0].image = hospital[0].image.split("&!!")[0];
        
        const family_member = await DataFind(`SELECT * FROM tbl_family_member WHERE id IN (${appoint[0].family_mem_id})`);
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', appoint: appoint[0], customer: customer[0], sebservice: sebservice[0], 
            hospital: hospital[0], family_member });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/appint_cancel_list', async (req, res) => {
    try {
        const cancel_reason = await DataFind(`SELECT id, title FROM tbl_appointment_cancel_list WHERE status = '1' ORDER BY id DESC;`);

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', cancel_reason });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/cancel_appointment', async (req, res) => {
    try {
        const {id, appointment_id, reason_id, reason} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "appointment_id", "reason_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const appoint = await DataFind(`SELECT id, customer_id, doctor_id, status, paid_amount, tot_price, site_commisiion, appointment_date, appointment_time, hospital_id, date_type
                                        FROM tbl_booked_appointment WHERE id = '${appointment_id}' AND doctor_id = '${id}';`);
        if (appoint == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Appointment not found!' });
        if (appoint[0].status != 1) return res.status(200).json({ ResponseCode: 401, Result:false, message: await AllFunction.AppointmentStatus(appoint[0].status) });
        
        const app_date = await DataFind(`SELECT id, book_time_list FROM tbl_doctor_hos_time WHERE doctor_id = '${appoint[0].doctor_id}' AND hospital_id = '${appoint[0].hospital_id}';`);
        app_date[0].book_time_list = typeof app_date[0].book_time_list == "string" ? JSON.parse(app_date[0].book_time_list) : app_date[0].book_time_list;

        const dind = app_date[0].book_time_list.find(bt => bt[appoint[0].appointment_date]);

        if (dind) {
            const date = appoint[0].appointment_date, type = appoint[0].date_type, time = appoint[0].appointment_time;
            const timeSlots = dind[date][type];
        
            if (timeSlots) {
                const updatedSlot = timeSlots.filter(t => t !== time);
                dind[date][type] = updatedSlot;
                
                if (updatedSlot.length === 0) {
                    delete dind[date][type];
                }
                
                if (Object.keys(dind[date]).length === 0) {
                    const index = app_date[0].book_time_list.findIndex(bt => bt[date]);
                    if (index !== -1) {
                        app_date[0].book_time_list.splice(index, 1);
                    }
                }
            }
        }

        const customer = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${appoint[0].customer_id}'`);

        let date = new Date();
        const treatment_time = {start_time: '', end_time: date.toISOString()};
        
        if (appoint[0].paid_amount > 0 && customer != '') {
            const tot_amount = customer[0].tot_balance + appoint[0].paid_amount;
            
            if (await DataUpdate(`tbl_customer`, `tot_balance = '${tot_amount}'`, `id = '${customer[0].id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }

            if (await DataInsert(`tbl_customer_wallet`, `customer_id, amount, date, payment_type, status, amount_type`,
                `'${customer[0].id}', '${appoint[0].paid_amount}', '${date.toISOString().split("T")[0]}', '0', '1', '${appointment_id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }
        }
        
        if (await DataUpdate(`tbl_booked_appointment`, `status = '5', treatment_time = '${JSON.stringify(treatment_time)}', cancel_id = '${reason_id}', 
            cancel_reason = ${await mysql.escape(reason)}`, `id = '${appoint[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        let payout_amount = Number((appoint[0].tot_price - appoint[0].site_commisiion).toFixed(2));
        if (await DataInsert(`tbl_doctor_payout_adjust`, `appointment_id, doctor_id, amount, date, status, p_status, image, p_type, upi_id, paypal_id, bank_no, bank_ifsc, bank_type`,
            `'${appoint[0].id}', '${appoint[0].doctor_id}', '${payout_amount}', '${date}', '1', '', '', '', '', '', '', '', ''`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        if (await DataUpdate(`tbl_doctor_hos_time`, `book_time_list = '${JSON.stringify(app_date[0].book_time_list)}'`, `id = '${app_date[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        if (await DataInsert(`tbl_notification`, `order_id, customer_id, service_user_id, date, mstatus, ostatus, notification`,
            `'${appoint[0].id}', '${appoint[0].customer_id}', '${appoint[0].doctor_id}', '${AllFunction.NotificationDate(date)}', '1', '5', 
            '❌ Your appointment has been cancelled. Please reschedule if needed. Appointment ID : # ${appoint[0].id}'`, req.hostname, req.protocol) == -1) {

            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Appointment cancel successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/start_treatment', async (req, res) => {
    try {
        const {id, appointment_id, otp} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "appointment_id", "otp"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const appoint = await DataFind(`SELECT id, customer_id, doctor_id, status, appointment_date, appointment_time, otp FROM tbl_booked_appointment WHERE id = '${appointment_id}' AND doctor_id = '${id}';`);
        if (appoint == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Appointment not found!' });
        
        if (appoint[0].status != 1) return res.status(200).json({ ResponseCode: 401, Result:false, message: await AllFunction.AppointmentStatus(appoint[0].status) });

        if (appoint[0].otp != Number(otp)) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Invalid otp!' });
        
        let sdate = new Date();
        const treatment_time = {start_time: sdate.toISOString(), end_time: ''};
        
        if (await DataUpdate(`tbl_booked_appointment`, `status = '2', otp = '${await AllFunction.otpGenerate(4)}', treatment_time = '${JSON.stringify(treatment_time)}'`, `id = '${appoint[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result: false, message: process.env.dataerror });
        }

        let sm = '👨‍⚕️ Your appointment has started. Please join the session or meet the doctor. '+
                'Start time:- '+ sdate.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', 
                minute: 'numeric', second: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }) +'';

        if (await DataInsert(`tbl_notification`, `order_id, customer_id, service_user_id, date, mstatus, ostatus, notification`,
            `'${appoint[0].id}', '${appoint[0].customer_id}', '${appoint[0].doctor_id}', '${AllFunction.NotificationDate(sdate)}', '1', '2', '${sm}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        const chat = await ChatFunction.Chat_Save(id, id, appoint[0].customer_id, sm, 'doctor', req.hostname, req.protocol);
        if (chat == 1) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });
        if (chat == 2) return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });

        return res.status(200).json({ ResponseCode: 200, Result: true, message: 'Treatment start successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.post("/patient_health_concerns", async(req, res)=>{
    try {
        const {id, appointment_id, fam_mem_id} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "appointment_id", "fam_mem_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const appoint = await DataFind(`SELECT family_mem_id, patient_health_concerns FROM tbl_booked_appointment WHERE id = '${appointment_id}' AND doctor_id = '${id}'`);

        if (appoint == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Appointment not found!' });
        if (appoint[0].family_mem_id.split(',').includes(fam_mem_id) == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Family member not found!' });
        
        const member_detail = appoint[0].patient_health_concerns.filter(val => val.fmid == fam_mem_id);
        const md = member_detail != '' ? member_detail[0] : { "fmid": "", "document": [], "health_concern": "" };

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', ...md });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.post('/appo_vit_phy_list', async (req, res) => {
    try {
        const {id, appointment_id, patient_id} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "appointment_id", "patient_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        let vitphy = await DataFind(`SELECT id, title FROM tbl_doctor_vitals_physical WHERE doctor_id = '${id}' AND status = '1';`);
        if(vitphy == '') return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data not found!', vit_phy_list: [] });

        let appoint = await DataFind(`SELECT id, vitals_physical FROM tbl_booked_appointment WHERE id = '${appointment_id}' AND doctor_id = '${id}';`);
        if(appoint == '') return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Appointment not found!', vit_phy_list: [] });
        
        const uvp = appoint[0].vitals_physical.find(val => val[patient_id]);

        let vitalsMap = [];
        if (uvp) {
            vitalsMap = uvp[patient_id].reduce((acc, item) => {
                acc[item.id] = item.text;
                return acc;
            }, {});
        }
        
        vitphy = vitphy.map(val => ({...val,text: vitalsMap[val.id] || ''}));
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', vit_phy_list: vitphy });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/add_appo_vit_phy', async (req, res) => {
    try {
        const {id, appointment_id, vitals_physical, patient_id} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "appointment_id", "vitals_physical", "patient_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const appoint = await DataFind(`SELECT boap.id, boap.customer_id, boap.status, boap.vitals_physical, COALESCE(cus.name) AS cus_name, COALESCE(doc.name) AS doc_name
                                        FROM tbl_booked_appointment AS boap
                                        LEFT JOIN tbl_customer AS cus ON cus.id = boap.customer_id
                                        LEFT JOIN tbl_doctor_list AS doc ON doc.id = boap.doctor_id
                                        WHERE boap.id = '${appointment_id}' AND boap.doctor_id = '${id}';`);
        if (appoint == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Appointment not found!' });

        if (appoint[0].status != 2) return res.status(200).json({ ResponseCode: 401, Result:false, message: await AllFunction.AppointmentStatus(appoint[0].status) });
        
        const uvp = appoint[0].vitals_physical.find(val => val[patient_id]);
        
        if (uvp) uvp[patient_id] = vitals_physical
        else appoint[0].vitals_physical.unshift({ [patient_id] : vitals_physical });
        
        if (await DataUpdate(`tbl_booked_appointment`, `vitals_physical = '${JSON.stringify(appoint[0].vitals_physical)}'`, `id = '${appoint[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        sendOneNotification(`Dear ${appoint[0].cus_name}, ${appoint[0].doc_name} has updated your health records with vital and physical information — please review for your well-being`, 
            'customer', appoint[0].customer_id, 1);
        sendOneNotification(`Dear ${appoint[0].cus_name}, ${appoint[0].doc_name} has updated your health records with vital and physical information — please review for your well-being`, 
            'customer', appoint[0].customer_id, 2);
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Vitials and Physical update successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.post('/appo_dru_pres_list', async (req, res) => {
    try {
        const {id, appointment_id, patient_id} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "appointment_id", "patient_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const vitphy = await DataFind(`SELECT id, title FROM tbl_doctor_vitals_physical WHERE doctor_id = '${id}';`);
        if(vitphy == '') return res.status(200).json({ ResponseCode: 200, Result: true, message: 'Data not found!', drug_presciption: [] });
        
        let drug_prescription = await DataFind(`SELECT ba.id AS appoint_id, dp.*, medi.name AS medicine_name
                                                FROM tbl_booked_appointment AS ba
                                                JOIN JSON_TABLE(
                                                    JSON_EXTRACT(ba.drugs_prescription, '$[*]."${patient_id}"[*]'),
                                                    '$[*]' COLUMNS (
                                                        id INT PATH '$.id',
                                                        mid INT PATH '$.mid',
                                                        Days LONGTEXT PATH '$.Days',
                                                        Time LONGTEXT PATH '$.Time',
                                                        type LONGTEXT PATH '$.type',
                                                        Dosage LONGTEXT PATH '$.Dosage',
                                                        Frequency LONGTEXT PATH '$.Frequency',
                                                        Instructions LONGTEXT PATH '$.Instructions'
                                                    )
                                                ) AS dp 
                                                JOIN tbl_doctor_medicine AS medi ON dp.mid = medi.id AND medi.status = '1'
                                                WHERE ba.id = '${appointment_id}' AND medi.doctor_id = '${id}';`);
                                                
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', drug_presciption:drug_prescription.reverse() });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/add_appo_dru_pres', async (req, res) => {
    try {
        const {id, appointment_id, patient_id, drugs_prescription} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "appointment_id", "patient_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const appoint = await DataFind(`SELECT boap.id, boap.customer_id, boap.status, boap.drugs_prescription, COALESCE(cus.name) AS cus_name, COALESCE(doc.name) AS doc_name
                                        FROM tbl_booked_appointment AS boap
                                        LEFT JOIN tbl_customer AS cus ON cus.id = boap.customer_id
                                        LEFT JOIN tbl_doctor_list AS doc ON doc.id = boap.doctor_id
                                        WHERE boap.id = '${appointment_id}' AND boap.doctor_id = '${id}';`);

        if (appoint == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Appointment not found!' });

        let dp = drugs_prescription;

        let dpf = appoint[0].drugs_prescription.find(val => val[patient_id]);
        if (dpf) {
            let avp = dpf[patient_id].find(val => val.id == dp.id);
            
            if (!avp) {
                delete dp.id
                dpf[patient_id].unshift({id: dpf[patient_id].length+1, ...dp});
            } else {
                avp.mid = dp.mid; avp.type = dp.type; avp.Dosage = dp.Dosage; avp.Frequency = dp.Frequency; avp.Days = dp.Days; avp.Time = dp.Time; avp.Instructions = dp.Instructions; 
            }

        } else {
            delete dp.id
            appoint[0].drugs_prescription.unshift({[patient_id]: [{id: 1, ...dp}]})
        }
        
        if (await DataUpdate(`tbl_booked_appointment`, `drugs_prescription = '${JSON.stringify(appoint[0].drugs_prescription)}'`, `id = '${appoint[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        sendOneNotification(`Dear ${appoint[0].cus_name}, ${appoint[0].doc_name} has added your prescription details — please review for your care.`, 
            'customer', appoint[0].customer_id, 1);
        sendOneNotification(`Dear ${appoint[0].cus_name}, ${appoint[0].doc_name} has added your prescription details — please review for your care.`, 
            'customer', appoint[0].customer_id, 2);

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Drugs and prescription add successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.post('/appo_diagnosis_list', async (req, res) => {
    try {
        const {id, appointment_id, patient_id} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "appointment_id", "patient_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const diagnosis = await DataFind(`SELECT id, name, description FROM tbl_doctor_diagnosis_test WHERE doctor_id = '${id}' AND status = '1';`);
        if(diagnosis == '') return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data not found!', diagnosis: [] });

        let appoint = await DataFind(`SELECT id, diagnosis_test FROM tbl_booked_appointment WHERE id = '${appointment_id}' AND doctor_id = '${id}';`);
        if(appoint == '') return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Appointment not found!', diagnosis: [] }); 
        
        let dt = appoint[0].diagnosis_test.find(val => val[patient_id]);
        dt = dt ? dt[patient_id] : [];
        
        diagnosis.map(val => {
            val.status = dt.includes(val.id) == true ? 1 : 0;
        });

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', diagnosis });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/add_appo_diagnosis', async (req, res) => {
    try {
        const {id, appointment_id, patient_id, diagnosis_list} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "appointment_id", "patient_id", "diagnosis_list"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const appoint = await DataFind(`SELECT boap.id, boap.customer_id, boap.status, boap.diagnosis_test, COALESCE(cus.name) AS cus_name, COALESCE(doc.name) AS doc_name
                                        FROM tbl_booked_appointment AS boap
                                        LEFT JOIN tbl_customer AS cus ON cus.id = boap.customer_id
                                        LEFT JOIN tbl_doctor_list AS doc ON doc.id = boap.doctor_id
                                        WHERE boap.id = '${appointment_id}' AND boap.doctor_id = '${id}';`);
        
        if (appoint == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Appointment not found!' });

        if (appoint[0].status != 2) return res.status(200).json({ ResponseCode: 401, Result:false, message: await AllFunction.AppointmentStatus(appoint[0].status) });
        
        const dt = appoint[0].diagnosis_test.find(val => val[patient_id]);
        
        if (dt) dt[patient_id] = diagnosis_list
        else appoint[0].diagnosis_test.unshift({[patient_id]: diagnosis_list})

        if (await DataUpdate(`tbl_booked_appointment`, `diagnosis_test = '${JSON.stringify(appoint[0].diagnosis_test)}'`, `id = '${appoint[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }
        
        sendOneNotification(`Dear ${appoint[0].cus_name}, ${appoint[0].doc_name} has recommended diagnostic tests for you — please review for further guidance.`, 
                            'customer', appoint[0].customer_id, 1);
        sendOneNotification(`Dear ${appoint[0].cus_name}, ${appoint[0].doc_name} has recommended diagnostic tests for you — please review for further guidance.`, 
                            'customer', appoint[0].customer_id, 2);

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Diagnosis test update successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/end_treatment', async (req, res) => {
    try {
        const {id, appointment_id, otp} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "appointment_id", "otp"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const ap = await DataFind(`SELECT boap.id, boap.customer_id, boap.doctor_id, boap.tot_price, boap.paid_amount, boap.wallet_amount, boap.site_commisiion, boap.wallet_amount, 
                                    boap.payment_id, boap.status, boap.appointment_date, boap.appointment_time, boap.treatment_time, boap.otp, COALESCE(cus.name, '') AS cus_name, 
                                    COALESCE(cus.pending_ref, '') AS pending_ref, COALESCE(cus.tot_balance, '') AS tot_balance, COALESCE(doc.name, '') AS doc_name, 
                                    COALESCE(doc.wallet, 0) AS doc_wallet, COALESCE(doc.cash_amount, 0) AS doc_cash_amount, COALESCE(doc.tot_payout, 0) AS doc_tot_payout,
                                    0 AS payout_amount, 0 AS cash_amount, 0 AS pay_cash
                                    FROM tbl_booked_appointment AS boap
                                    LEFT JOIN tbl_customer AS cus ON cus.id = boap.customer_id
                                    LEFT JOIN tbl_doctor_list AS doc ON doc.id = boap.doctor_id
                                    WHERE boap.id = '${appointment_id}' AND boap.doctor_id = '${id}';`);

        if (ap == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Appointment not found!' });
        const appo = ap[0];
        
        if (appo.status != 2) return res.status(200).json({ ResponseCode: 401, Result:false, message: await AllFunction.AppointmentStatus(appo.status) });
        
        if (appo.otp != Number(otp)) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Invalid otp!' });
        
        if (appo.payment_id != '16') appo.payout_amount = Number((appo.tot_price - appo.site_commisiion).toFixed(2));
        else {
            appo.pay_cash = Math.max(0, Number((appo.site_commisiion - appo.wallet_amount).toFixed(2)));
            appo.payout_amount = Math.max(0, Number((appo.wallet_amount - appo.site_commisiion).toFixed(2)));
            appo.paid_amount = appo.tot_price;
        }
        
        let date = new Date();
        if (appo.pay_cash > 0) {
            if (await DataInsert(`tbl_doctor_cash_adjust`, `appointment_id, doctor_id, status, proof_image, amount, date, payment_type, c_status`, 
                `'${appointment_id}', '${id}', '1', '', '${appo.pay_cash}', '${date.toISOString()}', '', ''`, req.hostname, req.protocol) == -1) {
        
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }
            
            appo.doc_cash_amount = Number((appo.doc_cash_amount + appo.pay_cash).toFixed(2));
        }
        
        if (appo.payout_amount > 0) {

            if (await DataInsert(`tbl_doctor_payout_adjust`, `appointment_id, doctor_id, amount, date, status, p_status, image, p_type, upi_id, paypal_id, bank_no, bank_ifsc, bank_type`,
                `'${appointment_id}', '${id}', '${appo.payout_amount}', '${date.toISOString()}', '1', '', '', '', '', '', '', '', ''`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }
            
            appo.doc_tot_payout = Number((appo.doc_tot_payout + appo.payout_amount).toFixed(2));
        }
        
        appo.doc_wallet = Number(( appo.doc_wallet + (appo.tot_price - appo.site_commisiion)).toFixed(2)); 
        
        appo.treatment_time.end_time = date.toISOString();
        
        if (await DataUpdate(`tbl_doctor_list`, `wallet = '${appo.doc_wallet}', cash_amount = '${appo.doc_cash_amount}', tot_payout = '${appo.doc_tot_payout}'`,
            `id = '${id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        if (await DataUpdate(`tbl_booked_appointment`, `status = ${appo.tot_price == appo.paid_amount ? '4' : '3'}, otp = '0', treatment_time = '${JSON.stringify(appo.treatment_time)}'`,
            `id = '${appo.id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        if (appo.pending_ref != '') {
            await AllFunction.SetReferralAmount(appo.pending_ref, appo.customer_id, appo.tot_balance);
        }
        
        let ms = `Hello ${appo.cus_name}, ${appo.doc_name} has recommended a treatment plan for you, please review it for better health!`
        sendOneNotification(ms, 'customer', appo.customer_id, 1);
        sendOneNotification(ms, 'customer', appo.customer_id, 2);

        if (await DataInsert(`tbl_notification`, `order_id, customer_id, service_user_id, date, mstatus, ostatus, notification`,
            `'${appo.id}', '${appo.customer_id}', '${appo.doctor_id}', '${AllFunction.NotificationDate(date)}', '1', '${appo.tot_price == appo.paid_amount ? '4' : '3'}', '${ms}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Appointment tratment end successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============= Receptionist ================ //

router.post('/receptionist_list', async (req, res) => {
    try {
        const {id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const receptionist_list = await DataFind(`SELECT * FROM tbl_doctor_receptionist WHERE doctor_id = '${id}' ORDER BY id DESC`);
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', receptionist_list });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/add_receptionist', async (req, res) => {
    try {
        const {id, country_code, phone, password, status} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "country_code", "phone", "password", "status"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const receptionist = await DataFind(`SELECT phone FROM tbl_doctor_list WHERE country_code = '${country_code}' AND phone = '${phone}'
                                                UNION SELECT phone FROM tbl_lab_list WHERE country_code = '${country_code}' AND phone = '${phone}'
                                                UNION SELECT phone FROM tbl_doctor_receptionist WHERE country_code = '${country_code}' AND phone = '${phone}'
                                                UNION SELECT phone FROM tbl_admin WHERE country_code = '${country_code}' AND phone = '${phone}'`);
        if (receptionist != "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Provided email already exist' });

        const hash = await bcrypt.hash(password, 10);
        
        if (await DataInsert(`tbl_doctor_receptionist`, `doctor_id, country_code, phone, password, status`, `'${id}', '${country_code}', '${phone}', '${hash}', '${status}'`, 
            req.hostname, req.protocol) == -1) {
        
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Receptionist add successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/edit_receptionist', async (req, res) => {
    try {
        const {id, recep_id, country_code, phone, password, status} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "recep_id", "country_code", "phone", "status"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const receptionist = await DataFind(`SELECT * FROM tbl_doctor_receptionist WHERE id = '${recep_id}' AND doctor_id = '${id}'`);
        if(receptionist == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data not found!' });

        const hash = password != "" ? await bcrypt.hash(password, 10) : receptionist[0].password;
        
        if (receptionist[0].country_code != country_code || receptionist[0].phone != phone) {
            const ec = await DataFind(`SELECT phone FROM tbl_doctor_list WHERE country_code = '${country_code}' AND phone = '${phone}'
                                        UNION SELECT phone FROM tbl_lab_list WHERE country_code = '${country_code}' AND phone = '${phone}'
                                        UNION SELECT phone FROM tbl_doctor_receptionist WHERE country_code = '${country_code}' AND phone = '${phone}'
                                        UNION SELECT phone FROM tbl_admin WHERE country_code = '${country_code}' AND phone = '${phone}'`);
            if (ec != '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Provided mobile number already exist' });
        }
        
        if (await DataUpdate(`tbl_doctor_receptionist`, `country_code = '${country_code}', phone = '${phone}', password = '${hash}', status = '${status}'`, `id = '${recep_id}'`,
            req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }
    
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Receptionist edit successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/delete_receptionist', async (req, res) => {
    try {
        const {id, recep_id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "recep_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const receptionist = await DataFind(`SELECT * FROM tbl_doctor_receptionist WHERE id = '${recep_id}' AND doctor_id = '${id}'`);
        if(receptionist == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data not found!' }); 

        if (await DataDelete(`tbl_doctor_receptionist`, `id = '${recep_id}' AND doctor_id = '${id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }
    
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Receptionist Delete successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.post('/total_earning', async (req, res) => {
    try {
        const {id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const doctor = await DataFind(`SELECT dl.wallet, dl.tot_payout, COALESCE(gs.d_min_withdraw, "0") AS d_min_withdraw
                                        FROM tbl_doctor_list AS dl
                                        LEFT JOIN tbl_general_settings AS gs ON 1 = 1
                                        WHERE dl.id = '${id}'`);
        if(doctor == '') return res.status(200).json({ ResponseCode: 200, Result: true, message: 'User not found!', doctor_amount: { "cash_amount": 0, "success_cash": 0 }, appointment_list: [] });

        const app = await DataFind(`SELECT bookap.id, (bookap.tot_price - bookap.site_commisiion) AS tot_earning, bookap.tot_price, bookap.site_commisiion, bookap.wallet_amount, 
                                    0 AS online_amount, 0 AS cash_amount,
                                    bookap.appointment_date, 
                                    bookap.appointment_time, CASE WHEN bookap.status IN (3,4) THEN 'completed' WHEN bookap.status IN (5) THEN 'canceled' END AS status_type,
                                    COALESCE(cus.name, '') AS cus_name, COALESCE(pd.name, '') AS p_name, bookap.wallet_amount AS wallet_status
                                    FROM tbl_booked_appointment AS bookap
                                    LEFT JOIN tbl_customer AS cus ON cus.id = bookap.customer_id
                                    LEFT JOIN tbl_payment_detail AS pd ON pd.id = bookap.payment_id
                                    WHERE bookap.doctor_id = '${id}' AND bookap.status IN (3,4,5) ORDER BY bookap.id DESC;`);
        
        if(app == '') return res.status(200).json({ ResponseCode: 200, Result: true, message: 'Data not found!', doctor_amount: doctor[0], appointment_list: [] });
        
        const all_data = [];
        app.forEach(item => {
            item.date = new Date(`${item.appointment_date} ${item.appointment_time}`).toISOString().split("T")[0];
            const dateString = new Date(item.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

            let existingDateEntry = all_data.find(entry => entry.date === dateString);

            if (!existingDateEntry) {
                existingDateEntry = {
                    date: dateString,
                    detail: []
                };
                all_data.push(existingDateEntry);
            }

            if (item.p_name != 'Cash') item.online_amount = Number((item.tot_price - item.wallet_amount).toFixed(2));
            else item.online_amount = 0;

            if (item.p_name == 'Cash') item.cash_amount = Number((item.tot_price - item.wallet_amount).toFixed(2));
            
            item.wallet_status = item.wallet_status > 0 ? 1 : 0;

            delete item.appointment_date; delete item.appointment_time;

            existingDateEntry.detail.push(item);
        });

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Total appointment earning load successful', doctor_amount: doctor[0], appointment_list: all_data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.post('/total_payout', async (req, res) => {
    try {
        const {id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const doctor = await DataFind(`SELECT tot_payout, success_payout FROM tbl_doctor_list WHERE id = '${id}'`);
        if(doctor == '') return res.status(200).json({ ResponseCode: 200, Result:true, message: 'User not found!', doctor_amount: { "tot_payout": 0, "success_payout": 0 }, payout_list: [] });

        const app = await DataFind(`SELECT id, appointment_id, doctor_id, amount, date, status, p_status, image, p_type
                                    FROM tbl_doctor_payout_adjust WHERE doctor_id = '${id}' ORDER BY id DESC`);
                                    
        if(app == '') return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data not found!', doctor_amount: doctor[0], payout_list: [] });

        app.map(val => {
            val.date = new Date(val.date).toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })
            delete val.appointment_time;
        });

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Total earning appointment load successful', doctor_amount: doctor[0], payout_list: app });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/payout_withdraw', async (req, res) => {
    try {
        const { id, Withdraw_amount, payment_type, upi_id, paypal_id, bank_no, bank_ifsc, bank_type } = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "Withdraw_amount", "payment_type"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const doctor = await DataFind(`SELECT id, tot_payout, success_payout FROM tbl_doctor_list WHERE id = '${id}'`);
        if (doctor == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'User Not Found!'});

        const general_setting = await DataFind(`SELECT d_min_withdraw FROM tbl_general_settings`);
        if (general_setting == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data Not Found!'});
        
        if (doctor[0].tot_payout >= general_setting[0].d_min_withdraw) {
            const date = new Date().toISOString();
            
            if (parseFloat(Withdraw_amount) >= parseFloat(general_setting[0].d_min_withdraw) && parseFloat(Withdraw_amount) <= doctor[0].tot_payout) {
                console.log(doctor[0].tot_payout);
                let check = 0, wid;
                if (payment_type == "UPI") {
                    const missingField = await AllFunction.BodyDataCheck(["upi_id"], req.body);
                    if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

                    check = 1;

                    wid = await DataInsert(`tbl_doctor_payout_adjust`, `appointment_id, doctor_id, amount, date, status, p_status, image, p_type, upi_id, paypal_id, bank_no, bank_ifsc, bank_type`,
                        `'', '${id}', '${Withdraw_amount}', '${date}', '2', '0', '', '1', '${upi_id}', '', '', '', ''`, req.hostname, req.protocol);
                    
                } else if (payment_type == "Paypal") {
                    const missingField = await AllFunction.BodyDataCheck(["paypal_id"], req.body);
                    if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

                    check = 1;

                    wid = await DataInsert(`tbl_doctor_payout_adjust`, `appointment_id, doctor_id, amount, date, status, p_status, image, p_type, upi_id, paypal_id, bank_no, bank_ifsc, bank_type`,
                        `'', '${id}', '${Withdraw_amount}', '${date}', '2', '0', '', '2', '', '${paypal_id}', '', '', ''`, req.hostname, req.protocol);
                    
                } else if (payment_type == "BANK Transfer") {
                    const missingField = await AllFunction.BodyDataCheck(["bank_no", "bank_ifsc", "bank_type"], req.body);
                    if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

                    check = 1;

                    wid = await DataInsert(`tbl_doctor_payout_adjust`, `appointment_id, doctor_id, amount, date, status, p_status, image, p_type, upi_id, paypal_id, bank_no, bank_ifsc, bank_type`,
                        `'', '${id}', '${Withdraw_amount}', '${date}', '2', '0', '', '3', '', '', '${bank_no}', '${bank_ifsc}', '${bank_type}'`, req.hostname, req.protocol);

                }
                if (wid == -1) return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });

                if (check == "1") {
                    let total = parseFloat((parseFloat(doctor[0].tot_payout) - parseFloat(Withdraw_amount)).toFixed(2));
                    let success_payout = parseFloat((parseFloat(doctor[0].success_payout) + parseFloat(Withdraw_amount)).toFixed(2));

                    if (await DataUpdate(`tbl_doctor_list`, `tot_payout = '${total}', success_payout = '${success_payout}'`, `id = '${doctor[0].id}'`, req.hostname, req.protocol) == -1) {
                        return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
                    }
                }

                return res.status(200).json({ ResponseCode: 200, Result:true, message: "Wallet Withdraw Request Add Successfully" });
            }
            return res.status(200).json({ ResponseCode: 401, Result:false, message: `Minimum Withdrawn Amount ${general_setting[0].d_min_withdraw}` });
        } else {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: `Minimum Withdrawn Amount ${general_setting[0].d_min_withdraw}` });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





router.post('/total_cash_management', async (req, res) => {
    try {
        const {id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const doctor = await DataFind(`SELECT cash_amount, success_cash FROM tbl_doctor_list WHERE id = '${id}'`);
        if(doctor == '') return res.status(200).json({ ResponseCode: 200, Result:true, message: 'User not found!', cash: { "cash_amount": 0, "success_cash": 0 }, cash_list: [] });

        const app = await DataFind(`SELECT * FROM tbl_doctor_cash_adjust WHERE doctor_id = '${id}' AND status = '2' ORDER BY id DESC`);
                                        
        if(app == '') return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data not found!', cash: doctor[0], cash_list: [] });
        
        const ad = await AllFunction.DateConvertDay(app);

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Total earning appointment load successful', cash: doctor[0], cash_list: ad });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/cash_management_history', async (req, res) => {
    try {
        const {id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const doctor = await DataFind(`SELECT cash_amount, success_cash FROM tbl_doctor_list WHERE id = '${id}'`);
        if(doctor == '') return res.status(200).json({ ResponseCode: 200, Result:true, message: 'User not found!', cash: { "cash_amount": 0, "success_cash": 0 }, cash_list: [] });

        const app = await DataFind(`SELECT bookap.id, (bookap.tot_price - bookap.site_commisiion) AS tot_earning, bookap.tot_price, bookap.site_commisiion, bookap.wallet_amount, 
                                    0 AS online_amount, 0 AS cash_amount, dca.amount AS add_cash, bookap.appointment_date, bookap.appointment_time,
                                    COALESCE(cus.name, '') AS cus_name, COALESCE(pd.name, '') AS p_name, bookap.wallet_amount AS wallet_status
                                    FROM tbl_doctor_cash_adjust AS dca
                                    JOIN tbl_booked_appointment AS bookap ON bookap.id = dca.appointment_id
                                    LEFT JOIN tbl_customer AS cus ON cus.id = bookap.customer_id
                                    LEFT JOIN tbl_payment_detail AS pd ON pd.id = bookap.payment_id
                                    WHERE dca.doctor_id = '${id}' ORDER BY dca.id DESC;`);
        
        if(app == '') return res.status(200).json({ ResponseCode: 200, Result: true, message: 'Data not found!', cash: doctor[0], cash_list: [] });
        
        const all_data = [];
        app.forEach(item => {
            item.date = new Date(`${item.appointment_date} ${item.appointment_time}`).toISOString().split("T")[0];
            const dateString = new Date(item.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

            let existingDateEntry = all_data.find(entry => entry.date === dateString);

            if (!existingDateEntry) {
                existingDateEntry = {
                    date: dateString,
                    detail: []
                };
                all_data.push(existingDateEntry);
            }

            if (item.p_name != 'Cash') item.online_amount = Number((item.tot_price - item.wallet_amount).toFixed(2));
            else item.online_amount = 0;

            if (item.p_name == 'Cash') item.cash_amount = Number((item.tot_price - item.wallet_amount).toFixed(2));
            
            item.wallet_status = item.wallet_status > 0 ? 1 : 0;

            delete item.appointment_date; delete item.appointment_time;

            existingDateEntry.detail.push(item);
        });

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Total earning appointment load successful', cash: doctor[0], cash_list: all_data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.post('/pages', async (req, res) => {
    try {
        const pages_data = await DataFind(`SELECT * FROM tbl_pages WHERE status = '1';`);
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', pages_data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



AllFunction.ImageUploadFolderCheck(`./public/uploads/cash_proof`);
const storage5 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/cash_proof");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const cash_proof = multer({storage : storage5});

router.post('/cash_withdraw', cash_proof.single("cash_proof_img"), async (req, res) => {
    try {
        const {id, cash_amount, payment_type} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "cash_amount", "payment_type"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });
        if (!req.file) return res.status(200).json({ ResponseCode: 401, Result:false, message: "Provide Image" });

        const doctor = await DataFind(`SELECT id, cash_amount, success_cash FROM tbl_doctor_list WHERE id = '${id}'`);
        if(doctor == '') {
            if (req.file) await AllFunction.DeleteImage("uploads/cash_proof/" + req.file.filename)
            return res.status(200).json({ ResponseCode: 401, Result:false, message: 'User not found!' });
        }

        if (doctor[0].cash_amount >= cash_amount) {
            
            const imageUrl = req.file ? "uploads/cash_proof/" + req.file.filename : null;

            if (await DataInsert(`tbl_doctor_cash_adjust`, `appointment_id, doctor_id, status, proof_image, amount, date, payment_type, c_status`, 
                `'', '${id}', '2', '${imageUrl}', '${cash_amount}', '${new Date().toISOString()}', '${payment_type}', '1'`, req.hostname, req.protocol) == -1) {
        
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }

            let cash_total = parseFloat((parseFloat(doctor[0].cash_amount) - parseFloat(cash_amount)).toFixed(2));
            let success_cash = parseFloat((parseFloat(doctor[0].success_cash) + parseFloat(cash_amount)).toFixed(2));
            
            if (await DataUpdate(`tbl_doctor_list`, `cash_amount = '${cash_total}', success_cash = '${success_cash}'`, `id = '${doctor[0].id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }
            return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Cash withdraw successful' });
        }
        return res.status(200).json({ ResponseCode: 200, Result:false, message: `Your available cash balance ${doctor[0].cash_amount}` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/delete_account', async (req, res) => {
    try {
        const { id } = req.body;
        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const doctor = await DataFind(`SELECT * FROM tbl_doctor_list WHERE id = '${id}'`);
         if (doctor == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'User not found!' });
        
        if (await DataUpdate(`tbl_doctor_list`, `status = '0'`, `id = '${doctor[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Account Deleted Successfully'});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





module.exports = router;
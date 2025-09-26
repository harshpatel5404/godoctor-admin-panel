/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */


const express = require("express");
const router = express.Router();
const bcrypt = require('bcrypt');
const multer  = require('multer');
const mysql = require('mysql');
const axios = require('axios');
const QRCode = require('qrcode');
const AllFunction = require("../route_function/function");
const ChatFunction = require("../route_function/chat_function");
const sendOneNotification = require("../middleware/send");
const patient_pdf = require("../route_function/pdf_function");
const { DataFind, DataInsert, DataUpdate, DataDelete, FullDataInsert } = require("../middleware/database_query");
const schedule = require('node-schedule');
const moment = require('moment-timezone');




router.post('/signup', async (req, res) => {
    try {
        const {Name, Email, ccode, phone, Password, referral_code} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["Name", "Email", "ccode", "phone", "Password"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });
        
        let login_phone  = await DataFind(`SELECT * FROM tbl_customer WHERE country_code = '${ccode}' AND phone = '${phone}'`);
        if (login_phone != "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Mobile number already registered!' });

        let email_check  = await DataFind(`SELECT * FROM tbl_customer WHERE email = '${Email}'`);
        if (email_check != "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Email Already Registered!' });

        let rc = [], rcdata = '';
        if (referral_code != '') {
            rc = await DataFind(`SELECT * FROM tbl_customer WHERE referral_code = '${referral_code}'`);
            if (rc != '') rcdata = rc[0].id;
        }

        const hash = await bcrypt.hash(Password, 10);

        let c_id = await DataInsert(`tbl_customer`, `image, name, email, country_code, phone, password, tot_balance, tot_favorite, status, referral_code, pending_ref, date`, 
            `'', '${Name}', '${Email}', '${ccode}', '${phone}', '${hash}', '0', '[]', '1', '${await AllFunction.generateReferralCode(6)}', '${rcdata}', 
            '${new Date().toISOString().split('T')[0]}'`, req.hostname, req.protocol)
        if (c_id == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        const customer  = await DataFind(`SELECT * FROM tbl_customer WHERE country_code = '${ccode}' AND phone = '${phone}' AND email = '${Email}'`);
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Upload successful', customer: customer[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/login", async(req, res)=>{
    try {
        const {ccode, phone, password} = req.body;

        const missingField = await AllFunction.BodyDataCheck(['ccode', 'phone', 'password'], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        let customer  = await DataFind(`SELECT * FROM tbl_customer WHERE country_code = '${ccode}' AND phone = '${phone}'`);

        if(customer == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Mobile Number Not Found!' });
        if(customer[0].status != "1") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Account Deactivated!' });

        const hash = await bcrypt.compare(password, customer[0].password);
        if(!hash) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Password Not match!' });

        customer[0].tot_favorite = typeof customer[0].tot_favorite == "string" ? [JSON.parse(customer[0].tot_favorite)[0] || {did: 0, dep_id: 0}] : [customer[0].tot_favorite[0] || {did: 0, dep_id: 0}];

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Login Successful', customer_detail: customer[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/forgot_password", async(req, res)=>{
    try {
        const {ccode, phone, password} = req.body;

        const missingField = await AllFunction.BodyDataCheck(['ccode', 'phone', 'password'], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        let customer  = await DataFind(`SELECT * FROM tbl_customer WHERE country_code = '${ccode}' AND phone = '${phone}'`);
        if(customer == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Mobile Number Not Found!' });

        let hash = await bcrypt.hash(password, 10);
        if (await DataUpdate(`tbl_customer`, `password = '${hash}'`, `id = '${customer[0].id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Password change successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



AllFunction.ImageUploadFolderCheck(`./public/uploads/customer`);
const storag1 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/customer");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);
    }
});

const customer = multer({storage : storag1});

router.post("/edit_profile", customer.single("image"), async(req, res)=>{
    try {
        const {id, name, email, ccode, phone, password} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "name", "email", "ccode", "phone"], req.body);
        if (missingField.status == false) {
            if (req.file) await AllFunction.DeleteImage("uploads/customer/" + req.file.filename);
            return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });
        }

        const cus  = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${id}'`);
        if (cus == "") {
            if (req.file) await AllFunction.DeleteImage("uploads/customer/" + req.file.filename);
            return res.status(200).json({ ResponseCode: 401, Result:false, message: 'User not found!' });
        }

        let imageUrl = "";
        if (req.file) {
            await AllFunction.DeleteImage(cus[0].image);
            imageUrl = "uploads/customer/" + req.file.filename;
        } else imageUrl = cus[0].image;

        if (cus[0].country_code != ccode || cus[0].phone != phone) {
            const login_phone = await DataFind(`SELECT * FROM tbl_customer WHERE country_code = '${ccode}' AND phone = '${phone}'`);
            if (login_phone != ""){
                if (req.file) await AllFunction.DeleteImage("uploads/customer/" + req.file.filename); 
                return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Mobile number already registered!' });
            }
        }

        if (cus[0].email != email) {
            const email_check  = await DataFind(`SELECT * FROM tbl_customer WHERE email = '${email}'`);
            if (email_check != "") {
                if (req.file) await AllFunction.DeleteImage("uploads/customer/" + req.file.filename); 
                return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Email Already Registered!' });
            }
        }

        const hash = password != '' ? await bcrypt.hash(password, 10) : cus[0].password

        if (await DataUpdate(`tbl_customer`, `image = '${imageUrl}', name = '${name}', email = '${email}', country_code = '${ccode}', phone = '${phone}', password = '${hash}'`, 
            `id = '${cus[0].id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        const cusaa  = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${id}'`);

        return res.status(200).json({ ResponseCode: 200, Result: true, message: 'Profile edit successful', customer_detail: cusaa[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.post("/mobile_check", async(req, res)=>{
    try {
        const {ccode, phone} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["ccode", "phone"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        let customer = await DataFind(`SELECT * FROM tbl_customer WHERE country_code = '${ccode}' AND phone = '${phone}'`);

        if(customer == "") return res.status(200).json({ ResponseCode: 200, Result:true, message: 'New number'});
        return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Number already registered!' });
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

router.post("/search_doctor", async(req, res)=>{
    try {
        const {text, lat, lon} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["lat", "lon"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const user_lat = Number(lat), user_lon = Number (lon), rd = await AllFunction.DoctorReviewCalculate('doc')

        const doctor_list = await DataFind(`SELECT doc.id, doc.logo, doc.name, doc.title, doc.subtitle, doc.tot_favorite,
                                            ROUND(6371 * ACOS(COS(RADIANS(${user_lat})) * COS(RADIANS(doc.latitude)) * 
                                            COS(RADIANS(doc.longitude) - RADIANS(${user_lon})) +
                                            SIN(RADIANS(${user_lat})) * SIN(RADIANS(doc.latitude))), 2) AS distance
                                            ${rd.tot_review} ${rd.avgstar}
                                            FROM tbl_doctor_list AS doc
                                            JOIN tbl_zone AS zon ON ST_Contains(
                                                zon.lat_lon_polygon,
                                                ST_SRID(ST_GeomFromText(CONCAT('POINT(', ${user_lon}, ' ', ${user_lat}, ')')), 4326)
                                            )
                                            JOIN tbl_zone AS dzon ON ST_Contains(
                                                dzon.lat_lon_polygon,
                                                ST_SRID(ST_GeomFromText(CONCAT('POINT(', doc.longitude, ' ', doc.latitude, ')')), 4326)
                                            )
                                            ${rd.table}
                                            WHERE (doc.name LIKE '%${text}%' OR doc.name LIKE '%${text}%' OR doc.name LIKE '%${text}%') AND doc.status = '1' AND zon.status = '1' AND dzon.status = '1'
                                            AND dzon.id = zon.id
                                            AND (
                                                SELECT COUNT(*) FROM tbl_doctor_hos_depart_list WHERE doctor_id = doc.id
                                            ) = (
                                                SELECT COUNT(*) FROM tbl_doctor_hos_depart_list 
                                                WHERE doctor_id = doc.id
                                                    AND sub_title <> ''
                                                    AND image <> '' 
                                                    AND client_visit_price <> 0 
                                                    AND video_consult_price <> 0
                                                    AND status = 1
                                            )
                                            GROUP BY doc.id, doc.logo, doc.name, doc.title, doc.subtitle, doc.tot_favorite;`);

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', doctor_list});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.post("/family_member_list", async(req, res)=>{
    try {
        const {id} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const family_member = await DataFind(`SELECT id, profile_image, name FROM tbl_family_member WHERE customer_id = '${id}' ORDER BY id DESC;`);

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', family_member});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get("/family_member_add_detail", async(req, res)=>{
    try {
        const blood_group_list = await DataFind(`SELECT id, name FROM tbl_blood_group WHERE status = '1'`);
        const relationship_list = await DataFind(`SELECT id, name FROM tbl_relationship WHERE status = '1'`);

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', blood_group_list, relationship_list});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})

AllFunction.ImageUploadFolderCheck(`./public/uploads/family_member`);
const storage3 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/family_member");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);
    },
});

const family_member = multer({storage : storage3});

router.post("/add_family_member", family_member.single("profile_image"), async(req, res)=>{
    try {
        const {customer_id, name, relationship, blood_type, gender, patient_age, national_id, height, weight, allergies, medical_history} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["customer_id", "name", "relationship", "blood_type", "gender", "patient_age", "national_id", "height", "weight", "allergies", "medical_history"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });
        
        const image = req.file ? `uploads/family_member/${req.file.filename}` : null

        if (await DataInsert(`tbl_family_member`, `customer_id, profile_image, name, relationship, blood_type, gender, patient_age, national_id, height, weight, allergies, 
            medical_history`, 
            `'${customer_id}', '${image}', '${name}', '${relationship}', '${blood_type}', '${gender}', '${patient_age}', '${national_id}', ${height}, '${weight}', '${allergies}', 
            '${medical_history}'`, 
            req.hostname, req.protocol) == -1) {

            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Family member add successful.'});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
})

router.post("/family_member_detail", async(req, res)=>{
    try {
        const {fid} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["fid"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });


        const fm = await DataFind(`SELECT * FROM tbl_family_member WHERE id = '${fid}'`);
        if (fm == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Family member not found!' });

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful.', data:fm[0]});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/edit_family_member", family_member.single("profile_image"), async(req, res)=>{
    try {
        const {fid, name, relationship, blood_type, gender, patient_age, national_id, height, weight, allergies, medical_history} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["fid", "name", "relationship", "blood_type", "gender", "patient_age", "national_id", "height", "weight", "allergies", "medical_history"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const fm = await DataFind(`SELECT * FROM tbl_family_member WHERE id = '${fid}'`);
        if (fm == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Family member not found!' });

        let image = '';
        if (req.file) {
            console.log(111);
            
            await AllFunction.DeleteImage(fm[0].profile_image);
            image = `uploads/family_member/${req.file.filename}`
        } else image = fm[0].profile_image;

        if (await DataUpdate(`tbl_family_member`, `profile_image = '${image}', name = '${name}', relationship = '${relationship}', blood_type = '${blood_type}', gender = '${gender}', 
            patient_age = '${patient_age}', national_id = '${national_id}', height = '${height}', weight = '${weight}', allergies = '${allergies}', medical_history = '${medical_history}'`, 
            `id = '${fm[0].id}'`, req.hostname, req.protocol) == -1) {
        
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Family member update successful.'});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });

    }
});



router.post("/home", async(req, res)=>{
    try {
        const {id, lat, lon} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "lat", "lon"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        let cus = [], family_member = [];

        if (id != 0) {
            cus = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${id}' AND status = '1'`);
            if (cus == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'User not found!' });
            cus[0].tot_favorite = typeof cus[0].tot_favorite == 'string' ? JSON.parse(cus[0].tot_favorite) : cus[0].tot_favorite;
        }
        
        const gs = await DataFind(`SELECT site_currency, one_app_id, one_app_id_react, google_map_key, agora_app_id, google_map_key FROM tbl_general_settings`);

        const department_list = await DataFind(`SELECT id, image, name FROM tbl_department_list ORDER BY id DESC;`);

        const banner_data = await DataFind(`SELECT tbl_banner.*, COALESCE(tbl_department_list.name, '') AS department_name
                                            FROM tbl_banner
                                            LEFT JOIN tbl_department_list on tbl_banner.department = tbl_department_list.id`);

        if (id != 0) {
            family_member = await DataFind(`SELECT id, profile_image, name FROM tbl_family_member WHERE customer_id = '${id}' ORDER BY id DESC;`);
        }
        
        const user_lat = Number(lat), user_lon = Number (lon), rd = await AllFunction.DoctorReviewCalculate('doc'), lrd = await AllFunction.LabReviewCalculate('lab');

        let fav_doctor_list = [];
        if (id != 0) {
            if (cus[0].tot_favorite != '') {
                const unionSQL = cus[0].tot_favorite.map((d, i) => `SELECT ${d.did} AS did, ${d.dep_id} AS dep_id`).join(' UNION ALL ');
        
                fav_doctor_list = await DataFind(`SELECT doc.id, deps.dep_id AS department_id, doc.logo, doc.cover_logo, doc.title, doc.address, doc.latitude, doc.longitude, 
                                                        dzon.name AS zone_name ${rd.tot_review} ${rd.avgstar},
        
                                                        ROUND(6371 * ACOS(COS(RADIANS(${user_lat})) * COS(RADIANS(doc.latitude)) * 
                                                        COS(RADIANS(doc.longitude) - RADIANS(${user_lon})) +
                                                        SIN(RADIANS(${user_lat})) * SIN(RADIANS(doc.latitude))), 2) AS distance_km
        
                                                        FROM tbl_doctor_list AS doc
                                                        ${rd.table}
                                                        JOIN (
                                                            ${unionSQL}
                                                        ) AS deps ON deps.did = doc.id
                                                        JOIN tbl_zone AS zon ON ST_Contains(
                                                            zon.lat_lon_polygon,
                                                            ST_SRID(ST_GeomFromText(CONCAT('POINT(', ${user_lon}, ' ', ${user_lat}, ')')), 4326)
                                                        )
                                                        JOIN tbl_zone AS dzon ON ST_Contains(
                                                            dzon.lat_lon_polygon,
                                                            ST_SRID(ST_GeomFromText(CONCAT('POINT(', doc.longitude, ' ', doc.latitude, ')')), 4326)
                                                        )
                                                        WHERE doc.status = '1' AND zon.status = '1' AND dzon.status = '1' AND dzon.id = zon.id
                                                        GROUP BY doc.id, deps.dep_id, doc.logo, doc.cover_logo, doc.title, doc.address, doc.latitude, doc.longitude, dzon.name`);
                
            }
        }

        const dy_list = await DataFind(`SELECT ds.id, ds.title, ds.module, ds.category,
                                        CASE 
                                            WHEN ds.module = 'Doctor' THEN dl.name
                                            WHEN ds.module = 'Lab' THEN lc.name
                                            WHEN ds.module = 'Hospital' THEN ds.category
                                            ELSE ""
                                        END AS name
                                        FROM tbl_dynamic_section AS ds
                                        LEFT JOIN tbl_department_list AS dl ON dl.id = ds.category AND ds.module = "Doctor"
                                        LEFT JOIN tbl_lab_category AS lc ON lc.id = ds.category AND ds.module != "Hospital"
                                        WHERE ds.status = '1'`);

        const dynamic_list = [];
        for (const d of dy_list) {
        
            if (d.module == "Doctor") {
                
                

                const dl = await DataFind(`SELECT doc.id, doc.logo, doc.name, dzon.name AS zone_name, doc.country_code, doc.phone, doc.address AS address,

                                            CAST(dhd.department_id AS UNSIGNED) AS department_id,
                                            ROUND(6371 * ACOS(COS(RADIANS(${user_lat})) * COS(RADIANS(doc.latitude)) * 
                                            COS(RADIANS(doc.longitude) - RADIANS(${user_lon})) +
                                            SIN(RADIANS(${user_lat})) * SIN(RADIANS(doc.latitude))), 2) AS distance
                
                                            ${rd.tot_review} ${rd.avgstar}
                                            FROM tbl_doctor_list AS doc
                                            JOIN tbl_zone AS zon ON ST_Contains(
                                                zon.lat_lon_polygon,
                                                ST_SRID(ST_GeomFromText(CONCAT('POINT(', ${user_lon}, ' ', ${user_lat}, ')')), 4326)
                                            )
                                            JOIN tbl_zone AS dzon ON ST_Contains(
                                                dzon.lat_lon_polygon,
                                                ST_SRID(ST_GeomFromText(CONCAT('POINT(', doc.longitude, ' ', doc.latitude, ')')), 4326)
                                            )
                                            JOIN tbl_doctor_hos_depart_list AS dhd ON dhd.doctor_id = doc.id AND dhd.department_id = '${d.category}' AND dhd.sub_title <> '' 
                                            AND dhd.client_visit_price <> 0 AND dhd.video_consult_price <> 0 AND dhd.status = '1'
                                            JOIN tbl_doctor_hos_time AS host ON host.doctor_id = doc.id AND host.date_time_list IS NOT NULL AND JSON_LENGTH(host.date_time_list) > 0
                                            ${rd.table}
                                            WHERE doc.status = '1' AND JSON_CONTAINS(doc.department_list, '${d.category}') AND zon.status = '1' AND dzon.status = '1'
                                            AND dzon.id = zon.id
                
                                            GROUP BY doc.id, doc.logo, doc.cover_logo, doc.title, doc.subtitle, doc.address, doc.country_code, doc.phone, dzon.name;`);
                
                if (dl != '') dynamic_list.push({ ...d, details: dl});

               
            
            } else if (d.module == "Lab") {
                
                const ll = await DataFind(`SELECT lab.id, lab.logo, lab.name, '' AS zone_name, lab.country_code, lab.phone, lab.address AS address, 0 AS department_id, 0 AS distance

                                            ${lrd.tot_review} ${lrd.avgstar}
                                            FROM tbl_lab_package_list AS lpl
                                            JOIN tbl_lab_list AS lab ON lab.id = lpl.lab_id AND lab.status = '1'
                                            ${lrd.table}
                                            WHERE JSON_CONTAINS(lpl.category_list, '${d.category}')
                                            GROUP BY lab.id, lab.logo, lab.name, lab.license_number, lab.address, lab.country_code, lab.phone`);                        
                
                if (ll != '') dynamic_list.push({ ...d, details: ll});
            
            } else if (d.module == "Hospital") {
            
                const hl = await DataFind(`SELECT doc.id, doc.logo, doc.name, dzon.name AS zone_name, doc.country_code, doc.phone, doc.address AS address, 
                    
                                            0 AS department_id, 
                                            ROUND(6371 * ACOS(COS(RADIANS(${user_lat})) * COS(RADIANS(doc.latitude)) * 
                                            COS(RADIANS(doc.longitude) - RADIANS(${user_lon})) +
                                            SIN(RADIANS(${user_lat})) * SIN(RADIANS(doc.latitude))), 2) AS distance
                
                                            ${rd.tot_review} ${rd.avgstar}
                                            FROM tbl_doctor_list AS doc
                                            JOIN tbl_zone AS zon ON ST_Contains(
                                                zon.lat_lon_polygon,
                                                ST_SRID(ST_GeomFromText(CONCAT('POINT(', ${user_lon}, ' ', ${user_lat}, ')')), 4326)
                                            )
                                            JOIN tbl_zone AS dzon ON ST_Contains(
                                                dzon.lat_lon_polygon,
                                                ST_SRID(ST_GeomFromText(CONCAT('POINT(', doc.longitude, ' ', doc.latitude, ')')), 4326)
                                            )
                                            ${rd.table}
                                            JOIN tbl_doctor_hos_time AS host ON host.doctor_id = doc.id AND host.date_time_list IS NOT NULL AND JSON_LENGTH(host.date_time_list) > 0
                                            WHERE doc.status = '1' AND JSON_CONTAINS(doc.hospital_list, '${d.category}') AND zon.status = '1' AND dzon.status = '1' 
                                            AND dzon.id = zon.id 
                                            AND EXISTS (
                                                SELECT 1 
                                                FROM tbl_doctor_hos_depart_list 
                                                WHERE doctor_id = doc.id 
                                                    AND hospital_id = '${d.category}'
                                                    AND sub_title <> ''
                                                    AND image <> '' 
                                                    AND client_visit_price <> 0 
                                                    AND video_consult_price <> 0
                                                    AND status = 1
                                            )
                                            GROUP BY doc.id, doc.logo, doc.name, dzon.name, doc.country_code, doc.phone, doc.address;`);
                hl.map(v => {
                    v.logo = v.logo.split("&!!")[0];
                });

                if (hl != '') dynamic_list.push({ ...d, details: hl});
            }
        };

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', general_currency: gs[0], department_list, banner_data, 
            family_member, fav_doctor_list, dynamic_list
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/map_doctor_list", async(req, res)=>{
    try {
        const {latitude, longitude, radius} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["latitude", "longitude", "radius"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const rd = await AllFunction.DoctorReviewCalculate('doc');

        const doctor_list = await DataFind(`SELECT doc.id, doc.logo, doc.title, doc.subtitle, doc.address, doc.latitude, doc.longitude, dzon.name AS zone_name,

                                            (SELECT dhd.department_id 
                                            FROM tbl_doctor_hos_depart_list AS dhd 
                                            WHERE dhd.doctor_id = doc.id AND dhd.sub_title != '' AND dhd.status = '1'
                                            ORDER BY dhd.id ASC LIMIT 1) AS department_id

                                            ${rd.tot_review} ${rd.avgstar}
                                            FROM tbl_doctor_list AS doc
                                            JOIN tbl_zone AS zon ON ST_Contains(
                                                zon.lat_lon_polygon,
                                                ST_SRID(ST_GeomFromText(CONCAT('POINT(', ${Number(longitude)}, ' ', ${Number(latitude)}, ')')), 4326)
                                            )
                                            JOIN tbl_zone AS dzon ON ST_Contains(
                                                dzon.lat_lon_polygon,
                                                ST_SRID(ST_GeomFromText(CONCAT('POINT(', doc.longitude, ' ', doc.latitude, ')')), 4326)
                                            )
                                            ${rd.table}
                                            WHERE doc.status = '1' AND zon.status = '1' AND dzon.status = '1' AND dzon.id = zon.id 
                                            
                                            AND (6371 * ACOS(COS(RADIANS(${Number(latitude)})) * COS(RADIANS(doc.latitude)) * 
                                            COS(RADIANS(doc.longitude) - RADIANS(${Number(longitude)})) +
                                            SIN(RADIANS(${Number(latitude)})) * SIN(RADIANS(doc.latitude)))) <= ${radius}

                                            GROUP BY doc.id, doc.logo, doc.cover_logo, doc.title, doc.subtitle, doc.address, doc.latitude, doc.longitude, dzon.name
                                            HAVING department_id IS NOT NULL;`);

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Address add successful', doctor_list });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.post("/add_address", async(req, res)=>{
    try {
        const {id, house_no, address, landmark, instruction, address_as, country_code, phone, latitude, longitude, google_address} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "house_no", "address", "landmark", "address_as", "country_code", "phone", "latitude", "longitude", "google_address"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });


        if (await DataInsert(`tbl_customer_address`,
            `customer_id, house_no, address, landmark, address_as, country_code, phone, latitude, longitude, google_address, instruction`,
            `'${id}', '${house_no}', '${address}', '${landmark}', '${address_as}', '${country_code}', '${phone}', '${latitude}', '${longitude}', '${google_address}', '${instruction}'`, req.hostname, req.protocol) == -1) {
        
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Address add successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/address_list", async(req, res)=>{
    try {
        const {id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id"], req.body); 
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const address_list = await DataFind(`SELECT * FROM tbl_customer_address WHERE customer_id = '${id}' `);

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', address_list });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/add_address", async(req, res)=>{
    try {
        const {id, house_no, address, landmark, instruction, address_as, country_code, phone, latitude, longitude, google_address} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "house_no", "address", "landmark", "address_as", "country_code", "phone", "latitude", "longitude", "google_address"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        if (await DataInsert(`tbl_customer_address`,
            `customer_id, house_no, address, landmark, address_as, country_code, phone, latitude, longitude, google_address, instruction`,
            `'${id}', '${house_no}', '${address}', '${landmark}', '${address_as}', '${country_code}', '${phone}', '${latitude}', '${longitude}', '${google_address}', '${instruction}'`, req.hostname, req.protocol) == -1) {
        
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Address add successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get("/payment_list", async(req, res)=>{
    try {
        const payment_list = await DataFind(`SELECT * FROM tbl_payment_detail WHERE status = '1'`);

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', payment_list });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get("/wallet_payment_list", async(req, res)=>{
    try {
        const payment_list = await DataFind(`SELECT * FROM tbl_payment_detail WHERE status = '1' AND wallet_status = '1'`);

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', payment_list });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/wallet_transaction_list", async(req, res)=>{
    try {
        const {id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const customer = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${id}' AND status = '1'`);
        if (customer == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'User not found!' });

        const wallet_list = await DataFind(`SELECT cw.*, COALESCE(pd.name, '') AS payment_name
                                            FROM tbl_customer_wallet AS cw
                                            LEFT JOIN tbl_payment_detail AS pd ON pd.id = cw.payment_type
                                            WHERE cw.customer_id = '${id}' ORDER BY id DESC`);

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Wallet add successful', tot_balance: customer[0].tot_balance, wallet_list });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/add_wallet", async(req, res)=>{
    try {
        const {id, amount, payment_type} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "amount", "payment_type"], req.body);
        if (missingField.status == false || isNaN(amount)) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const customer = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${id}' AND status = '1'`);
        if (customer == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'User not found!' });

        const tot_amount = customer[0].tot_balance + Number(amount);

        if (await DataUpdate(`tbl_customer`, `tot_balance = '${tot_amount}'`, `id = '${customer[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        if (await DataInsert(`tbl_customer_wallet`, `customer_id, amount, date, payment_type, status, amount_type`,
            `'${customer[0].id}', '${amount}', '${new Date().toISOString().split("T")[0]}', '${payment_type}', '7', '0'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Wallet add successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.post("/dep_type_doctor", async(req, res)=>{
    try {
        const {department_id, lat, lon} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["department_id", "lat", "lon"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const user_lat = Number(lat), user_lon = Number (lon), rd = await AllFunction.DoctorReviewCalculate('doc');

        
        

        const cvisit = await DataFind(`SELECT dhd.doctor_id AS id, ANY_VALUE(doc.logo) AS logo, ANY_VALUE(doc.title) AS title, ANY_VALUE(doc.subtitle) AS subtitle, 
                                        ANY_VALUE(doc.year_of_experience) AS year_of_experience, 
                                        MIN(dhd.client_visit_price) AS min_inp_price, MAX(dhd.client_visit_price) AS max_inp_price, 
                                        MIN(dhd.video_consult_price) AS min_vid_price, MAX(dhd.video_consult_price) AS max_vid_price, 
                                        ANY_VALUE(doc.latitude) AS latitude, ANY_VALUE(doc.longitude) AS longitude, ANY_VALUE(dzon.name) AS zone_name
                                        ${rd.tot_review} ${rd.avgstar}
                                        FROM tbl_doctor_hos_depart_list AS dhd
                                        JOIN tbl_doctor_list AS doc ON dhd.doctor_id = doc.id
                                        ${rd.table}
                                        JOIN tbl_zone AS zon ON ST_Contains(
                                            zon.lat_lon_polygon,
                                            ST_SRID(ST_GeomFromText(CONCAT('POINT(', ${user_lon}, ' ', ${user_lat}, ')')), 4326)
                                        )
                                        JOIN tbl_zone AS dzon ON ST_Contains(
                                            dzon.lat_lon_polygon,
                                            ST_SRID(ST_GeomFromText(CONCAT('POINT(', doc.longitude, ' ', doc.latitude, ')')), 4326)
                                        )
                                        JOIN tbl_doctor_hos_time AS host ON host.doctor_id = dhd.doctor_id AND host.date_time_list IS NOT NULL AND JSON_LENGTH(host.date_time_list) > 0
                                        WHERE dhd.department_id = '${department_id}' AND dhd.show_type IN (1,3) 
                                        AND dhd.sub_title <> ''AND dhd.client_visit_price <> 0 AND dhd.video_consult_price <> 0
                                        AND dhd.status = '1' AND doc.status = '1'
                                        AND zon.status = '1' AND dzon.status = '1' AND dzon.id = zon.id 
                                        GROUP BY dhd.doctor_id;`);

            let cvl = [];
            cvl = cvisit.map(async(dval) => {
                dval.distance_km = 0;
                return dval;
            });
            const clinic_visit = await Promise.all(cvl);
            
            const vc = await DataFind(`SELECT dhd.doctor_id AS id, ANY_VALUE(doc.logo) AS logo, ANY_VALUE(doc.title) AS title, ANY_VALUE(doc.subtitle) AS subtitle, 
                                        ANY_VALUE(doc.year_of_experience) AS year_of_experience, 
                                        MIN(dhd.client_visit_price) AS min_inp_price, MAX(dhd.client_visit_price) AS max_inp_price, 
                                        MIN(dhd.video_consult_price) AS min_vid_price, MAX(dhd.video_consult_price) AS max_vid_price, 
                                        ANY_VALUE(doc.latitude) AS latitude, ANY_VALUE(doc.longitude) AS longitude, ANY_VALUE(dzon.name) AS zone_name
                                        ${rd.tot_review} ${rd.avgstar}
                                        FROM tbl_doctor_hos_depart_list AS dhd
                                        JOIN tbl_doctor_list AS doc ON dhd.doctor_id = doc.id
                                        ${rd.table}
                                        JOIN tbl_zone AS zon ON ST_Contains(
                                            zon.lat_lon_polygon,
                                            ST_SRID(ST_GeomFromText(CONCAT('POINT(', ${user_lon}, ' ', ${user_lat}, ')')), 4326)
                                        )
                                        JOIN tbl_zone AS dzon ON ST_Contains(
                                            dzon.lat_lon_polygon,
                                            ST_SRID(ST_GeomFromText(CONCAT('POINT(', doc.longitude, ' ', doc.latitude, ')')), 4326)
                                        )
                                        JOIN tbl_doctor_hos_time AS host ON host.doctor_id = dhd.doctor_id AND host.date_time_list IS NOT NULL AND JSON_LENGTH(host.date_time_list) > 0
                                        WHERE dhd.department_id = '${department_id}' AND dhd.show_type IN (2,3) 
                                        AND dhd.sub_title <> ''AND dhd.client_visit_price <> 0 AND dhd.video_consult_price <> 0
                                        AND dhd.status = '1' AND doc.status = '1' 
                                        AND zon.status = '1' AND dzon.status = '1' AND dzon.id = zon.id 
                                        GROUP BY dhd.doctor_id;`);
            
            let vclist = [];
            vclist = vc.map(async(dval) => {
                dval.distance_km = 0;
                return dval;
            })
            const video_consult = await Promise.all(vclist);
            
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', clinic_visit, video_consult });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.post("/doctor_detail", async(req, res)=>{
    try {
        const {id, d_id, department_id} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "d_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        let cus = [], remhos = [];
        if (id != 0) {
            cus = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${id}' AND status = '1'`);
            if (cus == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'User not found!' });
        }

        let rd = await AllFunction.DoctorReviewCalculate('doc'), dep_sub_ser_list = [], head_des = [], ndatelist = [];
        const doctor = await DataFind(`SELECT doc.id, doc.logo, doc.cover_logo, doc.name, doc.email, doc.country_code, doc.phone, doc.verification_status, doc.title, doc.subtitle, 
                                        doc.description, doc.cancel_policy, doc.address, doc.pincode, doc.landmark, doc.commission, doc.year_of_experience, doc.per_patient_time,
                                        doc.tot_favorite,
                                        (
                                            SELECT 
                                                CASE 
                                                    WHEN COUNT(*) > 0 THEN 1
                                                    ELSE 0 
                                                END 
                                            FROM tbl_chat 
                                            WHERE (sender_id = doc.id AND receiver_id = ${id}) OR (sender_id = ${id} AND receiver_id = doc.id)
                                        ) AS chat_check,
                                        COALESCE(ba.appointment_date, '') AS ad, COALESCE(ba.appointment_time, '') AS at, 0 AS timecount
                                        ${rd.tot_review} ${rd.avgstar}
                                        FROM tbl_doctor_list AS doc
                                        LEFT JOIN (
                                            SELECT doctor_id, appointment_date, appointment_time
                                            FROM tbl_booked_appointment
                                            WHERE customer_id = ${id} AND show_type = 2 AND status IN (1,2)
                                            ORDER BY appointment_date DESC, appointment_time DESC
                                            LIMIT 1
                                        ) AS ba ON ba.doctor_id = doc.id
                                        ${rd.table}
                                        WHERE doc.id = '${d_id}' AND doc.status = '1'
                                        GROUP BY doc.id, doc.logo, doc.cover_logo, doc.title, doc.subtitle, doc.address, doc.latitude, doc.longitude, ba.appointment_date, 
                                        ba.appointment_time`);
        
        if (doctor == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Doctor not found!' });

        // console.log(doctor);
        
        if (doctor[0].ad != '' || doctor[0].at != '') {
            let timecount = await AllFunction.TwoTimeDiference(new Date(`${doctor[0].ad} ${doctor[0].at}`).toISOString(), new Date().toISOString());
            if (timecount.hour < 0 || timecount.minute < 0 || timecount.second < 0) doctor[0].timecount = 0;
            else doctor[0].timecount = Number(timecount.hour) * 60 * 60 + Number(timecount.minute) * 60 + Number(timecount.second);
        }

        dep_sub_ser_list = await DataFind(`SELECT id, hospital_id, department_id, sub_title, image, client_visit_price, video_consult_price, show_type
                                            FROM tbl_doctor_hos_depart_list
                                            WHERE doctor_id = '${d_id}' ${department_id != '0' ? `AND department_id = '${department_id}'` : ''} 
                                            AND sub_title <> '' AND status = '1' AND (IFNULL(client_visit_price, 0) <> 0 OR IFNULL(video_consult_price, 0) <> 0)
                                            
                                            -- (sub_title != '' OR image != '' OR client_visit_price != 0 OR video_consult_price != 0 OR status = '1')

                                            ORDER BY id DESC`);
        
        if (dep_sub_ser_list == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data not found!' });

        let min_inp_price = dep_sub_ser_list.length ? dep_sub_ser_list.reduce((min, val) => Math.min(min, val.client_visit_price), Infinity) : 0;
        let max_inp_price = dep_sub_ser_list.length ? dep_sub_ser_list.reduce((min, val) => Math.max(min, val.client_visit_price), -Infinity) : 0;
        let min_vid_price = dep_sub_ser_list.length ? dep_sub_ser_list.reduce((min, val) => Math.min(min, val.video_consult_price), Infinity) : 0;
        let max_vid_price = dep_sub_ser_list.length ? dep_sub_ser_list.reduce((min, val) => Math.max(min, val.video_consult_price), -Infinity) : 0;
        doctor[0].min_inp_price = min_inp_price; doctor[0].max_inp_price = max_inp_price; doctor[0].min_vid_price = min_vid_price; doctor[0].max_vid_price = max_vid_price;
        
        const [doc_hosp_list, about_data, review_data, award_data, gallery_list, faq_data] = await Promise.all([
            DataFind(`SELECT COALESCE(hos.id, 0) AS id , COALESCE(hos.image, '') AS image, COALESCE(hos.name, '') AS name, COALESCE(hos.email, '') AS email,
                        COALESCE(hos.country_code, '') AS country_code, COALESCE(hos.phone, '') AS phone, COALESCE(hos.address, '') AS address
                        FROM tbl_doctor_hos_depart_list AS dhd 
                        LEFT JOIN tbl_hospital_list AS hos ON hos.id = dhd.hospital_id AND hos.status = '1'
                        WHERE dhd.doctor_id = '${d_id}' AND dhd.sub_title <> '' 
                        AND (IFNULL(dhd.client_visit_price, 0) <> 0 OR IFNULL(dhd.video_consult_price, 0) <> 0) AND dhd.status = '1' GROUP BY dhd.hospital_id;`),

            DataFind(`SELECT * FROM tbl_about WHERE doctor_id = '${d_id}' ORDER BY id DESC`),

            DataFind(`SELECT dr.date, dr.review, dr.star_no, COALESCE(hos.name, '') AS hospital_name, COALESCE(cus.name, '') AS cus_name
                        FROM tbl_doctor_reviews AS dr 
                        LEFT JOIN tbl_customer AS cus ON cus.id = dr.customer_id
                        LEFT JOIN tbl_hospital_list AS hos ON hos.id = dr.hospital_id
                        WHERE dr.doctor_id = '${d_id}' ORDER BY dr.id DESC`),

            DataFind(`SELECT * FROM tbl_doctor_award_achievement WHERE doctor_id = '${d_id}' AND status = '1' ORDER BY id DESC`),

            DataFind(`SELECT image FROM tbl_doctor_gallery WHERE doctor_id = '${d_id}' ORDER BY id DESC`),

            DataFind(`SELECT title, description FROM tbl_doctor_faq WHERE doctor_id = '${d_id}' ORDER BY id DESC`)
        ]);
        
        if (about_data != "") {
            const aboutid = about_data[0].about_id.split("&!"), aboutheading = about_data[0].heading.split("&!"), aboutdes = about_data[0].description.split("&!");
            const abouttitle = about_data[0].title.split("&!"), abouticon = about_data[0].icon.split("&&!"), aboutsubtitle = about_data[0].sub_title.split("&&!");
    
            aboutheading.forEach((heading, index) => {
                let dataicon = abouticon[index].split("&!"), datasub = aboutsubtitle[index].split("&!"), about = [];
                for (let i = 0; i < dataicon.length;){
                    about.push({ id: aboutid[index], icon: dataicon[i], subtitle: datasub[i] });
                    i++;
                }
                head_des.push({ head: heading, description: aboutdes[index], title: abouttitle[index], about: about });
            });
        }

        review_data.map(val => {
            val.date = new Date(val.date).toISOString().split("T")[0];
        });

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', doctor:doctor[0], dep_sub_ser_list, about_data:head_des,
            review_data, award_data, gallery_list, faq_data, hospital_list: doc_hosp_list, alldate: await AllFunction.CurrentMaxBookDate() });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/doctor_appoint_slot", async (req, res) => {
    try {
        const { d_id, hospital_id, department_id, date } = req.body;

        const missingField = await AllFunction.BodyDataCheck(["d_id", "hospital_id", "department_id", "date"], req.body);
        if (missingField.status == false)
            return res.status(200).json({ ResponseCode: 401, Result: false, message: missingField.message });

        let [year, month, day] = date.split("-").map(Number);
        let ndate = new Date(year, month - 1, day);
        ndate.setHours(0, 0, 0, 0); // normalize time for comparison

        let today = new Date();
        today.setHours(0, 0, 0, 0);

        const validDate = new Date(year, month - 1, day);
        const isDateCorrect =
            validDate.getFullYear() === year &&
            validDate.getMonth() + 1 === month &&
            validDate.getDate() === day;

        if (!isDateCorrect || isNaN(ndate.getTime()) || ndate < today)
            return res.status(200).json({
                ResponseCode: 401,
                Result: false,
                message: 'Provide valid Date!',
                ndatelist: {},
                debug: { ndate: ndate.toISOString(), today: today.toISOString(), isDateCorrect }
            });

        // Get doctor details
        let doctor;
        try {
            doctor = await DataFind(`SELECT * FROM tbl_doctor_list WHERE id = '${d_id}' AND status = '1'`);
            if (doctor == '')
                return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Doctor not found!' });
        } catch (err) {
            console.error("Doctor query error:", err);
            return res.status(500).json({ ResponseCode: 500, Result: false, message: 'Error fetching doctor details' });
        }

        // Get doctor hospital timing list
        let dhd_list;
        try {
            dhd_list = await DataFind(`
                SELECT CAST(hos.id AS CHAR) AS hospital_id, COALESCE(hos.name, '') AS hospital_name, 
                    dht.date_time_list, dht.book_time_list
                FROM tbl_doctor_hos_time AS dht
                LEFT JOIN tbl_hospital_list AS hos ON hos.id = dht.hospital_id
                WHERE dht.doctor_id = '${d_id}'
            `);
        } catch (err) {
            console.error("Doctor hospital time query error:", err);
            return res.status(500).json({ ResponseCode: 500, Result: false, message: 'Error fetching hospital timing' });
        }

        // Get inactive hospital list for same doctor & department, but different hospital
        let dc;
        let remhos = [];
        try {
            dc = await DataFind(`
                SELECT id, hospital_id FROM tbl_doctor_hos_depart_list 
                WHERE doctor_id = '${d_id}' AND hospital_id != '${hospital_id}' AND department_id = '${department_id}' 
                AND status = '0' ORDER BY id DESC
            `);
            dc.map(d => {
                remhos.push(Number(d.hospital_id));
            });
        } catch (err) {
            console.error("Department check query error:", err);
            return res.status(500).json({ ResponseCode: 500, Result: false, message: 'Error fetching department data' });
        }

        let ndatelist = { ndatelist: [""] };

        if (dhd_list != '') {
            try {
                dhd_list[0].date_time_list = typeof dhd_list[0].date_time_list === "string"
                    ? JSON.parse(dhd_list[0].date_time_list)
                    : dhd_list[0].date_time_list;

                dhd_list[0].book_time_list = typeof dhd_list[0].book_time_list === "string"
                    ? JSON.parse(dhd_list[0].book_time_list)
                    : dhd_list[0].book_time_list;

                doctor[0].per_patient_time = doctor[0].per_patient_time != 0 &&
                    doctor[0].per_patient_time != 'null' &&
                    doctor[0].per_patient_time > 0 ? doctor[0].per_patient_time : 20;

                let { morning, afternoon, evening } = await AllFunction.generateAndSplitTimeSlots(doctor[0].per_patient_time);

                ndatelist = await AllFunction.TimeDurationApiSlot(dhd_list, morning, afternoon, evening, date, remhos);
            } catch (err) {
  console.error("Slot generation error:", err);
  return res.status(500).json({ 
    ResponseCode: 500, 
    Result: false, 
    message: 'Error generating time slots', 
    debug: {
      error: err.message,
      dhd_sample: dhd_list[0],
      per_patient_time: doctor[0].per_patient_time,
      date: date,
      remhos: remhos
    }
  });
}
        }

        return res.status(200).json({
            ResponseCode: 200,
            Result: true,
            message: 'Data load successful',
            ndatelist: ndatelist.ndatelist[0] != '' ? ndatelist.ndatelist[0] : {}
        });

    } catch (error) {
        console.error("Unexpected server error:", error);
        res.status(500).json({ ResponseCode: 500, Result: false, message: 'Internal server error' });
    }
});


router.post("/profile_department_detail", async(req, res)=>{
    try {
        const {d_id, department_id} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["d_id", "department_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const dep_sub_ser_list = await DataFind(`SELECT id, sub_title, image, client_visit_price, video_consult_price, show_type
                                                FROM tbl_doctor_hos_depart_list
                                                WHERE doctor_id = '${d_id}' AND department_id = '${department_id}' AND status = '1' ORDER BY id DESC`);
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', dep_sub_ser_list });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.post("/doc_favorite_add_remove", async(req, res)=>{
    try {
        const {id, d_id, department_id} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "d_id", "department_id"], req.body);
        if (missingField.status == false || isNaN(d_id)) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const cus = await DataFind(`SELECT id, tot_favorite FROM tbl_customer WHERE id = '${id}' AND status = '1'`);
        const doc = await DataFind(`SELECT id, tot_favorite FROM tbl_doctor_list WHERE id = '${d_id}' AND status = '1'`);
        if (cus == '' || doc == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'User not found!' });
        
        cus[0].tot_favorite = typeof cus[0].tot_favorite == "string" ? JSON.parse(cus[0].tot_favorite) : cus[0].tot_favorite;

        let idcheck = cus[0].tot_favorite.findIndex(val => val.did == Number(d_id)), favdata = [], message = '';
        
        if (idcheck == -1) {
            favdata = [{ did: Number(d_id), dep_id: Number(department_id) }].concat(cus[0].tot_favorite);
            doc[0].tot_favorite++;
            message = 'Add successful';
        } else {
            cus[0].tot_favorite.splice(idcheck, 1);
            favdata = cus[0].tot_favorite;
            doc[0].tot_favorite--;
            message = 'Remove successful'
        }
        
        if (await DataUpdate(`tbl_customer`, `tot_favorite = '${JSON.stringify(favdata)}'`, `id = '${cus[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }
        if (await DataUpdate(`tbl_doctor_list`, `tot_favorite = '${doc[0].tot_favorite >= 0 ? doc[0].tot_favorite : 0}'`, `id = '${doc[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }
        return res.status(200).json({ ResponseCode: 200, Result:true, message: message });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.post("/cart_data", async(req, res)=>{
    try {
        const {id, d_id, sub_depar_id, hospital_id} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "d_id", "sub_depar_id", "hospital_id"], req.body);
        if (missingField.status == false || isNaN(d_id)) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const cus = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${id}' AND status = '1'`);
        if (cus == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'User not found!' });

        const rd = await AllFunction.DoctorReviewCalculate('dl');
        const doc = await DataFind(`SELECT dl.id, dl.logo, dl.name, dl.country_code, dl.phone, dl.commission, dl.address, dl.pincode, dl.landmark, dl.year_of_experience
                                    ${rd.tot_review} ${rd.avgstar}
                                    FROM tbl_doctor_list AS dl
                                    ${rd.table}
                                    WHERE dl.id = '${d_id}' AND dl.status = '1'`);

        if (doc == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Doctor not found!' });

        const dep_sub_ser_list = await DataFind(`SELECT dhd.id, COALESCE(dl.name, '') AS department_name, dhd.sub_title, dhd.image, dhd.client_visit_price, 
                                                dhd.video_consult_price, dhd.show_type
                                                FROM tbl_doctor_hos_depart_list AS dhd
                                                LEFT JOIN tbl_department_list AS dl ON dl.id = dhd.department_id
                                                WHERE dhd.id = '${sub_depar_id}' AND dhd.sub_title != '' AND dhd.status = '1' ORDER BY id DESC`);

        if (dep_sub_ser_list == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data not found!' });

        const hospital = await DataFind(`SELECT id, image, name, email, country_code, phone, address FROM tbl_hospital_list WHERE id = '${hospital_id}' AND status = '1';`);
        if (hospital == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data not found!' });
        hospital[0].image = hospital[0].image.split("&!!")[0];
        
        const family_member = await DataFind(`SELECT * FROM tbl_family_member WHERE customer_id = '${id}'`);

        const commission_data = await DataFind(`SELECT commission_rate, commisiion_type FROM tbl_general_settings`);
        
        const doc_setting = await DataFind(`SELECT extra_patient_charge FROM tbl_doctor_setting WHERE doctor_id = '${d_id}'`);
        const extra_doctor_charge = doc_setting != '' ? doc_setting[0].extra_patient_charge : 0;
        
        let wallet_amount = 0;
        if (cus[0].tot_balance < 0) {
            if (await DataUpdate(`tbl_customer`, `tot_balance = '0'`, `id = '${cus[0].id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }
            wallet_amount = 0;
        } else wallet_amount = cus[0].tot_balance;
        
        const date = new Date().toISOString().split("T");
        const coupon = await DataFind(`SELECT id, doctor_id, title, sub_title, code, min_amount, discount_amount, start_date, end_date
                                        FROM tbl_coupon WHERE doctor_id = '${d_id}' AND start_date <= '${date[0]}' AND end_date >= '${date[0]}'`);
        
        coupon.map(cval => {
            cval.start_date = new Date(cval.start_date).toISOString().split("T")[0];
            cval.end_date = new Date(cval.end_date).toISOString().split("T")[0];
        })

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', wallet_amount, extra_doctor_charge, commission_data: commission_data != '' ? commission_data[0] : [], 
            doctor:doc[0], hospital: hospital[0], dep_sub_ser_list:dep_sub_ser_list[0], family_member, coupon });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/book_appointment", async(req, res)=>{
    const {id, d_id, department_id, hospital_id, sub_depar_id, date, date_type, time, family_mem_id, show_type, show_type_price, tot_price, additional_price, 
        coupon_id, coupon_amount, doctor_commission, site_commisiion, payment_id, wallet_amount, additional_note, transactionId, status
    } = req.body;

    let paid_amount = tot_price, bdate = new Date(), bookapp = 0, datec = [];
    try {

        console.log(req.body);
        
        const missingField = await AllFunction.BodyNumberDataCheck(["id", "d_id", "department_id", "hospital_id", "sub_depar_id", "date", "date_type", "time", "family_mem_id", 
            "show_type", "show_type_price", "tot_price", "additional_price", "coupon_amount", "doctor_commission", "site_commisiion", "wallet_amount"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });
        
       
        if (payment_id == '16') paid_amount = wallet_amount;

        const ndate = new Date(date), today = new Date();
        today.setHours(0, 0, 0, 0);
        const [year, month, day] = date.split("-").map(Number);
        const validDate = new Date(year, month - 1, day);
        const isDateCorrect = validDate.getFullYear() === year && validDate.getMonth() + 1 === month && validDate.getDate() === day;
        if(!isDateCorrect || isNaN(ndate.getTime()) || ndate < today) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Provide valid Date!' });
            
        const customer = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${id}' AND status = '1'`);
        if (customer == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'User not found!' });

        if (Number(wallet_amount) > customer[0].tot_balance) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Your wallet Balance is low!' });

        const dhd_list = await DataFind(`SELECT dhd.hospital_id, COALESCE(dep.name, '') AS department_name, COALESCE(doc.name, '') AS dname, COALESCE(hos.name, '') AS hospital_name, 
                                        COALESCE(dhd.sub_title, '') AS sub_title

                                        FROM tbl_doctor_hos_depart_list AS dhd
                                        LEFT JOIN tbl_doctor_list AS doc ON doc.id = ${d_id} AND doc.status = '1'
                                        LEFT JOIN tbl_hospital_list AS hos ON hos.id = ${hospital_id} AND hos.status = '1'
                                        LEFT JOIN tbl_department_list AS dep ON dep.id = dhd.department_id

                                        WHERE dhd.hospital_id = '${hospital_id}' AND dhd.department_id = '${department_id}' AND dhd.status = '1'
                                        GROUP BY dhd.hospital_id, dhd.sub_title, dep.name;`);

        if (dhd_list == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data not found!' });
        
        const dhd = await DataFind(`SELECT dht.id AS dt_id, CAST(hos.id AS CHAR) AS hospital_id, COALESCE(hos.name, '') AS hospital_name, 
                                        dht.date_time_list, dht.book_time_list
                                        FROM tbl_doctor_hos_time AS dht
                                        LEFT JOIN tbl_hospital_list AS hos ON hos.id = dht.hospital_id
                                        WHERE dht.doctor_id = '${d_id}' AND dht.hospital_id = '${hospital_id}' `);

        if (dhd == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Date not found!' });

        dhd[0].date_time_list = typeof dhd[0].date_time_list == "string" ? JSON.parse(dhd[0].date_time_list) : dhd[0].date_time_list;
        dhd[0].book_time_list = typeof dhd[0].book_time_list == "string" ? JSON.parse(dhd[0].book_time_list) : dhd[0].book_time_list;

        let date_day = new Date(date), daytype = AllFunction.AllDayList[date_day.getDay()], book_date = new Date();
        
       
        let book_date_str = book_date.toISOString().split('T')[0];
        dhd[0].book_time_list = dhd[0].book_time_list.filter(cval => {
            let key = Object.keys(cval)[0];
            return key >= book_date_str;
        });



        // // // check provided date and time in exist
        let fdate = dhd[0].date_time_list.find(val => val[daytype]);
        if (fdate) {

           

            let cdate = fdate[daytype][date_type];

            const check_d = new Set(cdate.map(item => item)).has(time);

            if (!check_d) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Invalid Time slot!' });

        } else return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Provided Date not available!' });



        // check date and time is already book time match and not match to add
        let match = dhd[0].book_time_list.find(item => item[date]);
        if (match) {
            if (match[date][date_type]) {

                let bookd = match[date][date_type];
                const check_d = new Set(bookd.map(item => item)).has(time);
                if(check_d) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Provided date is already Booked!' });
                bookd.push(time);

                
            
            } else {
                match[date][date_type] = match[date][date_type] ?? [];
                match[date][date_type].push(time);
            }
        } else dhd[0].book_time_list.push({ [date]: { [date_type]: [time] } });
        
       

        
        if (await DataUpdate(`tbl_doctor_hos_time`, `book_time_list = '${JSON.stringify(dhd[0].book_time_list)}'`, `id = '${dhd[0].dt_id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }
        datec = [{ doctor_id: d_id, hospital_id, appointment_date: date, date_type: date_type, appointment_time: time}];
        
        bookapp = await DataInsert(`tbl_booked_appointment`, `customer_id, doctor_id, hospital_id, department_id, sub_depar_id, status, book_date, appointment_date, 
            appointment_time, date_type, family_mem_id, show_type, show_type_price, tot_price, paid_amount, additional_price, coupon_id, coupon_amount, doctor_commission, 
            site_commisiion, payment_id, wallet_amount, additional_note, otp, treatment_time, patient_health_concerns, vitals_physical, drugs_prescription, diagnosis_test,
            cancel_id, cancel_reason, transactionId`,
            `'${id}', '${d_id}', '${hospital_id}', '${department_id}', '${sub_depar_id}', '1', '${bdate.toISOString()}', '${date}', '${time}', '${date_type}', '${family_mem_id}', 
            '${show_type}', '${show_type_price}', '${tot_price}', '${paid_amount}', '${additional_price}', '${coupon_id}', '${coupon_amount}', '${doctor_commission}', '${site_commisiion}', 
            '${payment_id}', '${wallet_amount}', '${additional_note}', '${await AllFunction.otpGenerate(4)}', '{}', '[]', '[]', '[]', '[]', '', '', '${transactionId}'`, 
            req.hostname, req.protocol);
        
        if (bookapp == -1) return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        
        if (await DataInsert(`tbl_notification`, `order_id, customer_id, service_user_id, date, mstatus, ostatus, notification`,
            `'${bookapp.insertId}', '${id}', '${d_id}', '${AllFunction.NotificationDate(bdate)}', '1', '1', 
            '🕒 Your doctor appointment request has been received and is pending confirmation. Appointment ID : # ${bookapp.insertId}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        sendOneNotification(`🕒 Your doctor appointment request has been received and is pending confirmation. Appointment ID : # ${bookapp.insertId}`, 'customer', id, 1);
        sendOneNotification(`🕒 Your doctor appointment request has been received and is pending confirmation. Appointment ID : # ${bookapp.insertId}`, 'customer', id, 2);
        sendOneNotification(`Received new appointment. Appointment ID : # ${bookapp.insertId}`, 'doctor', d_id, 1);

        if (wallet_amount > 0) {
            const tot_amount = customer[0].tot_balance - Number(wallet_amount);
    
            if (await DataUpdate(`tbl_customer`, `tot_balance = '${tot_amount}'`, `id = '${customer[0].id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }
    
            if (await DataInsert(`tbl_customer_wallet`, `customer_id, amount, date, payment_type, status, amount_type`,
                `'${customer[0].id}', '${wallet_amount}', '${new Date().toISOString().split("T")[0]}', '0', '2', '${bookapp.insertId}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }

        }
    
       
        let appointin = 'Appointment ID:- #'+ bookapp.insertId +'\n\n'+
                        'Doctor name:- '+ dhd_list[0].dname +'\n\n'+
                        'Hospital:- '+ dhd_list[0].hospital_name +'\n'+
                        'Department:- '+ dhd_list[0].department_name +'\n'+
                        'Department type:- '+ dhd_list[0].sub_title +'\n\n'+
                        'Book date:- '+ bdate.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', 
                                        minute: 'numeric', second: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }) +'\n'+
                        'Appointment date:- '+ date +'\n'+
                        'Appointment time:- '+ time +'\n\n'+
                        'Appointment type:- '+ `${show_type == '1' ? "In person" : "Video visit"}` +'\n'+
                        'Payment status:- '+ `${tot_price == paid_amount ? "Paid" : "Unpaid"}` +'';
        
        const chat = await ChatFunction.Chat_Save(d_id, d_id, id, appointin, 'doctor', req.hostname, req.protocol)
        if (chat == 1) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });
        if (chat == 2) res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
    
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Appointment book successful', appointment_id: bookapp.insertId });
        


       

    } catch (error) {
        console.error(error);
       
        if (datec.length != 0) {
            // console.log(111);
            
            const app_date = await DataFind(`SELECT id, book_time_list FROM tbl_doctor_hos_time WHERE doctor_id = '${datec[0].doctor_id}' AND hospital_id = '${datec[0].hospital_id}';`);
            if (app_date == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Hodpital & Time not found' });

            app_date[0].book_time_list = typeof app_date[0].book_time_list == "string" ? JSON.parse(app_date[0].book_time_list) : app_date[0].book_time_list;

            const dind = app_date[0].book_time_list.find(bt => bt[datec[0].appointment_date]);

            if (dind) {
                const date = datec[0].appointment_date, type = datec[0].date_type, time = datec[0].appointment_time;
            
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

            if (await DataUpdate(`tbl_doctor_hos_time`, `book_time_list = '${JSON.stringify(app_date[0].book_time_list)}'`, `id = '${app_date[0].id}'`, hostname, protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }
        }

        const cus = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${uid}'`);
        if (paid_amount > 0 && cus != '') {
            // console.log(222);
            const tot_amount = cus[0].tot_balance + paid_amount;

            if (await DataUpdate(`tbl_customer`, `tot_balance = '${tot_amount}'`, `id = '${cus[0].id}'`, hostname, protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }

            if (await DataInsert(`tbl_customer_wallet`, `customer_id, amount, date, payment_type, status, amount_type`,
                `'${cus[0].id}', '${paid_amount}', '${new Date().toISOString().split("T")[0]}', '0', '9', '${payment_id}'`, hostname, protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }
        }

        if (bookapp != 0) {
            // console.log(333);
            if (await DataDelete(`tbl_booked_appointment`, `id = '${bookapp.insertId}'`, hostname, protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }
        }

        res.status(500).json({ Result: false, error: 'Internal server error' });
    }
});



router.post("/success_appo_detail", async(req, res)=>{
    try {
        const {id, appointment_id} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const appoint = await DataFind(`SELECT boap.id, 
                                        COALESCE(hos.name, '') AS hospital_name,
                                        COALESCE(dep.name, '') AS department_name,
                                        COALESCE(dhd.sub_title, '') AS sub_title,

                                        boap.book_date, 
                                        boap.appointment_date, boap.appointment_time, boap.date_type, boap.show_type, boap.show_type_price, boap.tot_price,
                                        boap.paid_amount, boap.additional_price, boap.coupon_amount, boap.doctor_commission, boap.site_commisiion, boap.payment_id, 
                                        boap.wallet_amount, COALESCE(pd.image, '') AS payment_image, COALESCE(pd.name, '') AS payment_name
                                        FROM tbl_booked_appointment AS boap
                                        LEFT JOIN tbl_payment_detail AS pd ON pd.id = boap.payment_id

                                        LEFT JOIN tbl_hospital_list AS hos ON hos.id = boap.hospital_id
                                        LEFT JOIN tbl_department_list AS dep ON dep.id = boap.department_id
                                        LEFT JOIN tbl_doctor_hos_depart_list dhd ON dhd.id = boap.sub_depar_id
                                        WHERE boap.id = '${appointment_id}' AND boap.customer_id = '${id}'`);

        if (appoint == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data not found!' });

        const date = new Date(appoint[0].book_date);
        const formattedDate = date.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
        appoint[0].book_date = formattedDate;

        if (appoint[0].wallet_amount != 0 && appoint[0].payment_name != '') appoint[0].online_amount = Number((appoint[0].tot_price - appoint[0].wallet_amount).toFixed(2));
        else if (appoint[0].wallet_amount == 0 && appoint[0].payment_name != '') appoint[0].online_amount = appoint[0].tot_price;
        else appoint[0].online_amount = 0;

        const qrCodeData = await QRCode.toDataURL(`Your Appointment ID :- #${appointment_id}`);
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', appoint_data: appoint[0], qrcode: qrCodeData });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


router.post("/booked_appointment_list", async(req, res)=>{
    try {
        const {id} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const appoint_list = await DataFind(`SELECT bap.id, COALESCE(doc.id, 0) AS did, COALESCE(doc.logo) AS doc_logo, COALESCE(doc.title) AS doc_title, 
                                                COALESCE(dep.name, '') AS depart_name, bap.book_date, bap.appointment_date, bap.appointment_time, bap.tot_price, bap.show_type,
                                                COALESCE(doc.name) AS name, COALESCE(doc.country_code) AS country_code, COALESCE(doc.phone) AS phone,
                                                CASE 
                                                    WHEN bap.status = '1' THEN 'Pending'
                                                    WHEN bap.status = '2' THEN 'Service Start'
                                                    WHEN bap.status = '3' THEN 'Service End'
                                                    WHEN bap.status = '4' THEN 'Completed'
                                                    WHEN bap.status = '5' THEN 'Canceled'
                                                END AS status_type
                                                FROM tbl_booked_appointment AS bap
                                                LEFT JOIN tbl_doctor_list AS doc ON doc.id = bap.doctor_id AND doc.status = '1'
                                                LEFT JOIN tbl_department_list AS dep ON dep.id = bap.department_id
                                                WHERE bap.customer_id = '${id}';`);
        
        const forma_app_list = appoint_list.map(val => ({
            ...val,
            book_date: new Date(val.book_date).toLocaleString('en-US', { 
                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone 
            })
        }));

        const pending_appoint_list = [...forma_app_list].filter(val => ["Pending", "Service Start", "Service End"].includes(val.status_type)).reverse();
        const complete_appoint_list = [...forma_app_list].filter(val => ["Completed", "Canceled"].includes(val.status_type)).reverse();
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', pending_appoint_list, complete_appoint_list });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/appointment_detail", async(req, res)=>{
    try {
        const {id, appointment_id} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "appointment_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const appoint = await DataFind(`SELECT boap.id, boap.customer_id, boap.doctor_id, boap.hospital_id, boap.department_id, boap.sub_depar_id, boap.status, boap.book_date, 
                                        boap.appointment_date, boap.appointment_time, boap.date_type, boap.family_mem_id, boap.show_type, boap.show_type_price, boap.tot_price,
                                        boap.paid_amount, boap.additional_price, boap.coupon_id, boap.coupon_amount, boap.doctor_commission, boap.site_commisiion, 
                                        boap.wallet_amount, 0 AS online_amount, 0 AS cash_amount,
                                        boap.payment_id, COALESCE(pd.name, '') AS payment_name, COALESCE(pd.image, '') AS payment_image, boap.additional_note,
                                        boap.vitals_physical, boap.drugs_prescription, boap.diagnosis_test,
                                        (
                                            SELECT COUNT(*) FROM tbl_doctor_reviews 
                                            WHERE appointment_id = boap.id AND customer_id = boap.customer_id
                                        ) AS review_check,
                                        0 AS timecount, COALESCE(cl.title, '') AS cancel_title, COALESCE(boap.cancel_reason, '') AS cancel_reason, boap.transactionId,
                                        boap.otp, '' AS qrcode
                                        FROM tbl_booked_appointment AS boap
                                        LEFT JOIN tbl_payment_detail AS pd ON pd.id = boap.payment_id
                                        LEFT JOIN tbl_appointment_cancel_list AS cl ON cl.id = boap.cancel_id AND boap.cancel_id != ''
                                        WHERE boap.id = '${appointment_id}' AND boap.customer_id = '${id}';`);
        
        if (appoint == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Appointment not found!' });

        const date = new Date(appoint[0].book_date);
        const formattedDate = date.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
        appoint[0].book_date = formattedDate;   

        const qrdata = {id: appoint[0].id, otp: appoint[0].otp}, fm = appoint[0].family_mem_id.split(",");
        appoint[0].qrcode = await QRCode.toDataURL(`${JSON.stringify(qrdata)}`);
        
        appoint[0].vitals_physical = typeof appoint[0].vitals_physical == "string" ? JSON.parse(appoint[0].vitals_physical) : appoint[0].vitals_physical;
        appoint[0].drugs_prescription = typeof appoint[0].drugs_prescription == "string" ? JSON.parse(appoint[0].drugs_prescription) : appoint[0].drugs_prescription;
        appoint[0].diagnosis_test = typeof appoint[0].diagnosis_test == "string" ? JSON.parse(appoint[0].diagnosis_test) : appoint[0].diagnosis_test;
        
        const vp = appoint[0].vitals_physical.find(vpv => vpv[fm[0]]);
        const dp = appoint[0].drugs_prescription.find(dpv => dpv[fm[0]]);
        const dt = appoint[0].diagnosis_test.find(dtv => dtv[fm[0]]);
        
        appoint[0].vitals_physical = vp ? 1 : 0
        appoint[0].drugs_prescription = dp ? 1 : 0
        appoint[0].diagnosis_test = dt ? 1 : 0
        
        let timecount = await AllFunction.TwoTimeDiference(new Date(`${appoint[0].appointment_date} ${appoint[0].appointment_time}`).toISOString(), new Date().toISOString());
        if (timecount.hour < 0 || timecount.minute < 0 || timecount.second < 0) appoint[0].timecount = 0;
        else appoint[0].timecount = Number(timecount.hour) * 60 * 60 + Number(timecount.minute) * 60 + Number(timecount.second);

        

        if (appoint[0].payment_name != 'Cash') appoint[0].online_amount = Number((appoint[0].tot_price - appoint[0].wallet_amount).toFixed(2));
        else appoint[0].online_amount = 0;

        if (appoint[0].payment_name == 'Cash') appoint[0].cash_amount = Number((appoint[0].tot_price - appoint[0].paid_amount).toFixed(2));

        const rd = await AllFunction.DoctorReviewCalculate('dl');
        const doctor = await DataFind(`SELECT dl.id, dl.logo, dl.name, dl.country_code, dl.phone, dl.address, dl.pincode, dl.landmark, dl.year_of_experience
                                        ${rd.tot_review} ${rd.avgstar}
                                        FROM tbl_doctor_list AS dl
                                        ${rd.table}
                                        WHERE dl.id = '${appoint[0].doctor_id}' AND dl.status = '1'`);

        const sebservice = await DataFind(`SELECT dhd.id, COALESCE(dl.image) AS depart_image, COALESCE(dl.name, '') AS department_name, dhd.sub_title, dhd.image, dhd.client_visit_price, 
                                            dhd.video_consult_price, dhd.show_type
                                            FROM tbl_doctor_hos_depart_list AS dhd
                                            LEFT JOIN tbl_department_list AS dl ON dl.id = dhd.department_id
                                            WHERE dhd.id = '${appoint[0].sub_depar_id}' AND dhd.sub_title != '' ORDER BY id DESC`);
        
        const hospital = await DataFind(`SELECT id, image, name, email, country_code, phone, address, latitude, longitude FROM tbl_hospital_list WHERE id = '${appoint[0].hospital_id}' AND status = '1';`);
        
        if (hospital != '') hospital[0].image = hospital[0].image.split("&!!")[0];  
        
        const family_member = await DataFind(`SELECT * FROM tbl_family_member WHERE id IN (${appoint[0].family_mem_id})`);
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', appoint: appoint[0], doctor: doctor[0], sebservice: sebservice[0], 
            hospital: hospital[0], family_member });
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

        const appoint = await DataFind(`SELECT boap.family_mem_id, boap.patient_health_concerns
                                        FROM tbl_booked_appointment AS boap
                                        WHERE boap.id = '${appointment_id}' AND boap.customer_id = '${id}'`);
        
        if (appoint == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Appointment not found!' });
        if (appoint[0].family_mem_id.split(',').includes(fam_mem_id) == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Family member not found!' });
        
        const member_detail = appoint[0].patient_health_concerns.filter(val => val.fmid == fam_mem_id);
        const md = member_detail != '' ? member_detail[0] : { "fmid": "", "document": [], "health_concern": "" }
            
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', ...md });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

AllFunction.ImageUploadFolderCheck(`./public/uploads/patient_health_concern`);
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/patient_health_concern");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const patient_health_concern = multer({storage : storage});

router.post("/add_patient_health_concerns", patient_health_concern.array("document"), async(req, res)=>{
    try {
        const {id, appointment_id, fam_mem_id, health_concern} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "appointment_id", "fam_mem_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const appoint = await DataFind(`SELECT boap.family_mem_id, boap.patient_health_concerns
                                        FROM tbl_booked_appointment AS boap
                                        WHERE boap.id = '${appointment_id}' AND boap.customer_id = '${id}'`);
        
        if (appoint == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Appointment not found!' });
        if (appoint[0].family_mem_id.split(',').includes(fam_mem_id) == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Family member not found!' });
        
        const md = appoint[0].patient_health_concerns.find(val => val.fmid == fam_mem_id);
        
        let document = [];
        console.log(req.files);
        
        if (req.files.length > 0) {
            for (const img of req.files) {
                document.push(`uploads/patient_health_concern/${img.filename}`);
            }
        }
        
        if (md) {
            md.health_concern = health_concern;
            md.document = md.document.concat(document);
        } else appoint[0].patient_health_concerns.push({ fmid: fam_mem_id, health_concern: health_concern, document: document });

        if (await DataUpdate(`tbl_booked_appointment`, `patient_health_concerns = '${JSON.stringify(appoint[0].patient_health_concerns)}'`, `id = '${appointment_id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Health concern Update successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/remove_pati_heal_image", async(req, res)=>{
    try {
        const {id, appointment_id, fam_mem_id, removed_image} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "appointment_id", "removed_image"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const appoint = await DataFind(`SELECT boap.family_mem_id, boap.patient_health_concerns
                                        FROM tbl_booked_appointment AS boap
                                        WHERE boap.id = '${appointment_id}' AND boap.customer_id = '${id}'`);
        
        if (appoint == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Appointment not found!' });
        if (appoint[0].family_mem_id.split(',').includes(fam_mem_id) == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Family member not found!' });
        
        const md = appoint[0].patient_health_concerns.find(val => val.fmid == fam_mem_id);
        if (!md) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Patient health concerns not found!' });
        
        if (removed_image != '') {
            const imglist = removed_image.split('&!!');
            let il = md.document
            for (const img of imglist) {
                il = il.filter(ival => ival != img);
                await AllFunction.DeleteImage(img);
            }
            md.document = il;
        }

        if (await DataUpdate(`tbl_booked_appointment`, `patient_health_concerns = '${JSON.stringify(appoint[0].patient_health_concerns)}'`, `id = '${appointment_id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Health concern Update successful' });
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
                                        FROM tbl_booked_appointment 
                                        WHERE id = '${appointment_id}' AND customer_id = '${id}';`);
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

        if (appoint[0].paid_amount > 0 && customer.length > 0) {
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
    
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
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

router.post("/check_doc_appoint_upload", async(req, res)=>{
    try {
        const {id, appointment_id, fid} = req.body;

        const missingField = ["id", "appointment_id", "fid"].find(field => !req.body[field]);
        if(missingField) return res.send({ ResponseCode: 401, Result:false, message: "Data Not Found" });

        const appoint = await DataFind(`SELECT id, status, vitals_physical, drugs_prescription, diagnosis_test FROM tbl_booked_appointment 
                                        WHERE id = '${appointment_id}' AND customer_id = '${id}';`);

        if (appoint == '') return res.send({ ResponseCode: 401, Result:false, message: "Appointment Not Found" });
        
        appoint[0].vitals_physical = typeof appoint[0].vitals_physical == "string" ? JSON.parse(appoint[0].vitals_physical) : appoint[0].vitals_physical;
        appoint[0].drugs_prescription = typeof appoint[0].drugs_prescription == "string" ? JSON.parse(appoint[0].drugs_prescription) : appoint[0].drugs_prescription;
        appoint[0].diagnosis_test = typeof appoint[0].diagnosis_test == "string" ? JSON.parse(appoint[0].diagnosis_test) : appoint[0].diagnosis_test;
        
        const vp = appoint[0].vitals_physical.find(vpv => vpv[fid]);
        const dp = appoint[0].drugs_prescription.find(dpv => dpv[fid]);
        const dt = appoint[0].diagnosis_test.find(dtv => dtv[fid]);
        
        return res.send({ ResponseCode: 200, Result:true, message: "Details Check Successfully", vitals_physical: vp ? 1 : 0, drugs_prescription: dp ? 1 : 0, diagnosis_test: dt ? 1 : 0 });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/appoi_vit_phy_list", async(req, res)=>{
    try {
        const {id, appointment_id, patient_id} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "appointment_id", "patient_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const appoint = await DataFind(`SELECT dvp.id, dvp.title, vp.text
                                        FROM tbl_booked_appointment AS ba
                                        JOIN JSON_TABLE(
                                            JSON_EXTRACT(ba.vitals_physical, '$[*]."${patient_id}"[*]'),
                                            '$[*]' COLUMNS (
                                                id INT PATH '$.id', text LONGTEXT PATH '$.text'
                                            )
                                        ) AS vp
                                        JOIN tbl_doctor_vitals_physical AS dvp ON vp.id = dvp.id AND dvp.doctor_id = ba.doctor_id AND dvp.status = '1'
                                        WHERE ba.id = '${appointment_id}' AND ba.customer_id = '${id}';`);

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', vit_phy_list: appoint.sort((a, b) => a.id - b.id) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/appo_dru_pres_list", async(req, res)=>{
    try {
        const {id, appointment_id, patient_id} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "appointment_id", "patient_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        let drug_presciption = await DataFind(`SELECT ba.id AS appoint_id, dp.*, medi.name AS medicine_name
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
                                                WHERE ba.id = '${appointment_id}' AND ba.customer_id = '${id}';`);

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', drug_presciption });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/appo_diagnosis_list", async(req, res)=>{
    try {
        const {id, appointment_id, patient_id} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "appointment_id", "patient_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        let appoint = await DataFind(`SELECT ddt.id AS id, ddt.name AS name, ddt.description AS description
                                        FROM tbl_booked_appointment AS boap
                                        JOIN tbl_doctor_diagnosis_test AS ddt
                                        ON JSON_CONTAINS(
                                            JSON_EXTRACT(boap.diagnosis_test, '$[*]."${patient_id}"'), 
                                            CAST(ddt.id AS JSON)
                                        )
                                        AND ddt.status = '1'
                                        WHERE boap.id = '${appointment_id}' AND boap.customer_id = '${id}';`);

        if(appoint == '') return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Appointment not found!', appoint }); 
            
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', appoint });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/add_appint_review', async (req, res) => {
    try {
        const {id, appointment_id, review, tot_star} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "appointment_id", "tot_star"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result: false, message: missingField.message });

        const appoint = await DataFind(`SELECT boap.id, boap.doctor_id, boap.hospital_id, 
                                        COALESCE(cus.name) AS cus_name, COALESCE(doc.name) AS doc_name
                                        FROM tbl_booked_appointment AS boap
                                        LEFT JOIN tbl_customer AS cus ON cus.id = boap.customer_id
                                        LEFT JOIN tbl_doctor_list AS doc ON doc.id = boap.doctor_id AND doc.status = '1'
                                        WHERE boap.id = '${appointment_id}' AND boap.customer_id = '${id}';`);

        if (appoint == '') return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Appointment not found!' });
        
        if (await DataInsert(`tbl_doctor_reviews`, `appointment_id, doctor_id, customer_id, hospital_id, date, review, star_no`, 
            `'${appointment_id}', '${appoint[0].doctor_id}', '${id}', '${appoint[0].hospital_id}', '${new Date().toISOString()}', ${await mysql.escape(review)}, '${tot_star}'`, 
            req.hostname, req.protocol) == -1) {
    
            return res.status(200).json({ ResponseCode: 401, Result: false, message: process.env.dataerror });
        }

        sendOneNotification(`Dear Dr. ${appoint[0].doc_name}, ${appoint[0].cus_name} has submitted a review for you, please take a moment to read it!`, 'doctor', appoint[0].doctor_id, 1);

        return res.status(200).json({ ResponseCode: 200, Result: true, message: 'Appointment Review Add Successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/generate_patient_pdf', async (req, res) => {
    try {
        const { id, appointment_id, family_mem_id } = req.body;

        // Check for missing fields
        let missingField;
        try {
            missingField = await AllFunction.BodyDataCheck(["id", "appointment_id", "family_mem_id"], req.body);
        } catch (err) {
            console.error("Error checking body fields:", err);
            return res.status(500).json({ ResponseCode: 500, Result: false, message: "Error validating input fields" });
        }

        if (missingField.status === false) {
            return res.status(200).json({ ResponseCode: 401, Result: false, message: missingField.message });
        }

        // Generate PDF
        let ppdf;
try {
    ppdf = await patient_pdf.CreateAppointmentPDF(appointment_id, id, family_mem_id);
    if (!ppdf.status) {
        console.error("PDF generation failed:", ppdf.error);
        return res.status(500).json({ 
            ResponseCode: 500, 
            Result: false, 
            message: ppdf.error,
            details: ppdf.stack 
        });
    }
} catch (err) {
    console.error("Error generating PDF:", err);
    return res.status(500).json({ 
        ResponseCode: 500, 
        Result: false, 
        message: err.message || 'PDF generation failed',
        details: err.stack
    });
}

        if (ppdf.status === false) {
            return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Appointment not found!' });
        }

        // Return success response
        return res.status(200).json({
            ResponseCode: 200,
            Result: true,
            message: 'Patient PDF created successfully',
            pdf_URL: ppdf.url
        });

    } catch (error) {
        console.error("Unexpected error:", error);
        return res.status(500).json({ ResponseCode: 500, Result: false, message: 'Internal server error' });
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

router.post('/send_doctor_notified', async (req, res) => {
    try {
        const {id, doctor_id} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "doctor_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const customer = await DataFind(`SELECT id, name FROM tbl_customer WHERE id = '${id}';`);
        if (customer == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'User not found!' });

        sendOneNotification(`${customer[0].name} is available for their scheduled treatment. Please connect with them as soon as possible.`, 'doctor', doctor_id, 1);

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Notification send successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.post('/search_meidicine', async (req, res) => {
    try {
        const {text} = req.body;

        const medicine = await DataFind(`SELECT JSON_ARRAYAGG(TRIM(name)) AS names FROM tbl_doctor_medicine WHERE name LIKE '%${text}%';`);
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', medicine: medicine[0].names != null ? medicine[0].names : [] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

let jobs = [];

async function scheduleDailyJob(timeString) {
    const [time, modifier] = timeString.split(" ");
    let [hour, minute] = time.split(":").map(Number);

    if (modifier === "PM" && hour !== 12) hour += 12;
    if (modifier === "AM" && hour === 12) hour = 0;

    const now = moment().tz('Asia/Kolkata');
    let nextRun = moment.tz('Asia/Kolkata').hour(hour).minute(minute).second(0);

    if (now.isAfter(nextRun)) {
        nextRun = nextRun.add(1, 'day'); // if time already passed today, schedule for tomorrow
    }

    return nextRun.toDate(); // return a native Date object
}

router.post('/medicince_reminder_list', async (req, res) => {
    try {
        let {id} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });
        
        const remider_list = await DataFind(`SELECT * FROM tbl_customer_medicine_reminder WHERE customer_id = ${id};`);
        if(remider_list == '') return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data not found!', remider_list: [] });

        remider_list.map(rl => {
            rl.time = typeof rl.time == 'string' ? JSON.parse(rl.time) : rl.time;
        });

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', remider_list });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


async function Reschedule_Medi_Reminder() {
    const remider = await DataFind(`SELECT cmr.*, COALESCE(cus.name, '') AS cus_name 
                                        FROM tbl_customer_medicine_reminder AS cmr
                                        JOIN tbl_customer AS cus ON cus.id = cmr.customer_id
                                        WHERE cmr.status = '1';`);

    remider.forEach(async(rem) => {
        let ptime = typeof rem.time == "string" ? JSON.parse(rem.time) : rem.time;
        
        let nuid = Number(rem.customer_id);
        let joblist = jobs.find(item => item[nuid]);

        for (let i = 0; i < ptime.length;) {
            
            let job = schedule.scheduleJob(await scheduleDailyJob(ptime[i].time), async function() {
                sendOneNotification(`Hello ${rem.cus_name}! Your medicine time is here: Please take ${rem.cus_name} and continue your healing journey.`, 'customer', rem.customer_id, 1);
                sendOneNotification(`Hello ${rem.cus_name}! Your medicine time is here: Please take ${rem.cus_name} and continue your healing journey.`, 'customer', rem.customer_id, 2);
            });
            
            if (joblist) joblist[nuid].push({remin_id: rem.id, cus_id: nuid, job});
            else {
                if (i == 0) jobs.push({[nuid]: [{remin_id: rem.id, cus_id: nuid, job}]});
                else {
                    let njob = jobs.find(item => item[nuid]);
                    if (njob) njob[nuid].push({remin_id: rem.id, cus_id: nuid, job});
                    else jobs.push({[nuid]: [{remin_id: rem.id, cus_id: nuid, job}]});
                }
            }
            i++;
        }
    });
}
Reschedule_Medi_Reminder();

router.post('/add_medicince_reminder', async (req, res) => {
    try {
        let {id, medicine_name, time, status} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "medicine_name", "time", "status"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const customer = await DataFind(`SELECT name FROM tbl_customer WHERE id = ${id} AND status = '1';`);
        if(customer == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'User not found!' });

        let joblist = jobs.find(item => item[id]), nuid = Number(id);
        
        const insertId = await DataInsert(`tbl_customer_medicine_reminder`, `customer_id, medicine_name, time, status`,
            `'${id}', '${medicine_name}', '${JSON.stringify(time)}', '${status}'`, req.hostname, req.protocol)
        
        if (insertId == -1) return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        
        for (let i = 0; i < time.length;) {
            
            let job = schedule.scheduleJob(await scheduleDailyJob(time[i].time), async function() {
                
                sendOneNotification(`Hello ${customer[0].name}! Your medicine time is here: Please take ${medicine_name} and continue your healing journey.`, 'customer', id, 1);
                sendOneNotification(`Hello ${customer[0].name}! Your medicine time is here: Please take ${medicine_name} and continue your healing journey.`, 'customer', id, 2);
            });
            
            if (joblist) joblist[nuid].push({remin_id: insertId.insertId, cus_id: nuid, job});
            else {
                if (i == 0) jobs.push({[nuid]: [{remin_id: insertId.insertId, cus_id: nuid, job}]});
                else {
                    let njob = jobs.find(item => item[nuid]);
                    if (njob) njob[nuid].push({remin_id: insertId.insertId, cus_id: nuid, job});
                    else jobs.push({[nuid]: [{remin_id: insertId.insertId, cus_id: nuid, job}]});
                }
            }

            time[i].id = i+1;
            i++;
        }
        
        if (await DataUpdate(`tbl_customer_medicine_reminder`, `time = '${JSON.stringify(time)}'`, 
            `id = '${insertId.insertId}'`, req.hostname, req.protocol) == -1) {
    
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Remider add successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/edit_medicince_reminder', async (req, res) => {
    try {
        let {id, reminder_id, medicine_name, time, status} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "reminder_id", "medicine_name", "time", "status"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const remider = await DataFind(`SELECT cmr.*, COALESCE(cus.name, '') AS cus_name 
                                        FROM tbl_customer_medicine_reminder AS cmr
                                        JOIN tbl_customer AS cus ON cus.id = cmr.customer_id
                                        WHERE cmr.id = '${reminder_id}';`);
        if(remider == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Reminder not found!' });

        remider[0].time = typeof remider[0].time == 'string' ? JSON.parse(remider[0].time) : remider[0].time;

        let joblist = jobs.find(item => item[id]), nuid = Number(id);
        
        if (joblist) {
            
            let jl = joblist[nuid];
            
            let erd = jl.filter(item => item.remin_id == remider[0].id);
            
            for (let a = 0; a < erd.length;) {

                if (erd[a].remin_id == remider[0].id && erd[a].cus_id == nuid) {
                    erd[a].job.cancel();
                    console.log("cancel");
                }
                a++;
            }
        }
        
        if (status == "1") {
            
            for (let i = 0; i < time.length;) {
                
                let job = schedule.scheduleJob(await scheduleDailyJob(time[i].time), async function() {
    
                    console.log("111");
                    
                    sendOneNotification(`Hello ${remider[0].cus_name}! Your medicine time is here: Please take ${medicine_name} and continue your healing journey.`, 'customer', id, 1);
                    sendOneNotification(`Hello ${remider[0].cus_name}! Your medicine time is here: Please take ${medicine_name} and continue your healing journey.`, 'customer', id, 2);
                });
                
                if (joblist) joblist[nuid].push({remin_id: remider[0].id, cus_id: nuid, job});
                else {
                    if (i == 0) jobs.push({[nuid]: [{remin_id: remider[0].id, cus_id: nuid, job}]});
                    else {
                        let njob = jobs.find(item => item[nuid]);
                        if (njob) njob[nuid].push({remin_id: remider[0].id, cus_id: nuid, job});
                        else jobs.push({[nuid]: [{remin_id: remider[0].id, cus_id: nuid, job}]});
                    }
                }
    
                time[i].id = i+1;
                i++;
            }
        }

        if (await DataUpdate(`tbl_customer_medicine_reminder`, `medicine_name = '${medicine_name}', time = '${JSON.stringify(time)}', status = '${status}'`, 
            `id = '${reminder_id}'`, req.hostname, req.protocol) == -1) {
    
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Remider update successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/delete_medicince_reminder', async (req, res) => {
    try {
        let {id, reminder_id} = req.body;
    
        const missingField = await AllFunction.BodyDataCheck(["id", "reminder_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const remider = await DataFind(`SELECT * FROM tbl_customer_medicine_reminder WHERE id = '${reminder_id}';`);
        if(remider == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Reminder not found!' });

        let joblist = jobs.find(item => item[id]), nuid = Number(id);
        
        if (joblist) {
            
            let jl = joblist[nuid];
            let erd = jl.filter(item => item.remin_id == remider[0].id);
            for (let a = 0; a < erd.length;) {
                
                if (erd[a].remin_id == remider[0].id && erd[a].cus_id == nuid) {
                    erd[a].job.cancel();
                    console.log("cancel");
                }
                a++;
            }
        }
        
        if (await DataDelete(`tbl_customer_medicine_reminder`, `id = '${reminder_id}'`, req.hostname, req.protocol) == -1) {
        
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Remider delete successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





router.get('/lab_category_list', async (req, res) => {
    try {
        const banner_list = await DataFind(`SELECT images FROM tbl_lab_banner;`);

        let images = [];
        if (banner_list != '') {
            images = banner_list[0].images.split("&!!");
        }

        const category_list = await DataFind(`SELECT id, image, name FROM tbl_lab_category WHERE status = '1';`);

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', banner_list: images, category_list });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/category_lab_list', async (req, res) => {
    try {
        const {category_id, lat, lon} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["category_id", "lat", "lon"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const rd = await AllFunction.LabReviewCalculate('lab');
        const lab_list = await DataFind(`SELECT COALESCE(MAX(lab.id), 0) AS id, COALESCE(lab.logo, '') AS logo, COALESCE(lab.name, '') AS name, COALESCE(lab.address, '') AS address, 
                                            ROUND(6371 * ACOS(COS(RADIANS(${Number(lat)})) * COS(RADIANS(lab.latitude)) * 
                                            COS(RADIANS(lab.longitude) - RADIANS(${Number(lon)})) +
                                            SIN(RADIANS(${Number(lat)})) * SIN(RADIANS(lab.latitude))), 2) AS distance
                                            ${rd.tot_review} ${rd.avgstar}
                                            FROM tbl_lab_package_list AS pl
                                            JOIN tbl_lab_list AS lab ON lab.id = pl.lab_id
                                            JOIN tbl_zone AS zon ON ST_Contains(
                                                zon.lat_lon_polygon,
                                                ST_SRID(ST_GeomFromText(CONCAT('POINT(', ${Number(lon)}, ' ', ${Number(lat)}, ')')), 4326)
                                            )
                                            JOIN tbl_zone AS dzon ON ST_Contains(
                                                dzon.lat_lon_polygon,
                                                ST_SRID(ST_GeomFromText(CONCAT('POINT(', lab.longitude, ' ', lab.latitude, ')')), 4326)
                                            )
                                            ${rd.table}
                                            WHERE JSON_CONTAINS(pl.category_list, '${category_id}', '$') AND pl.status = '1' AND lab.status = '1' 
                                            AND zon.status = '1' AND dzon.status = '1' AND dzon.id = zon.id
                                            GROUP BY lab.id, dzon.name;`);

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', lab_list });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/lab_package_list', async (req, res) => {
    try {
        const {id, category_id, lab_id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "category_id", "lab_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const pl = await DataFind(`SELECT lpl.id, lpl.logo, lpl.title, lpl.fasting_require, lpl.test_report_time, lpl.package_name, lpl.package_price, lpl.package_type 
                                    ${id != 0 ? `, IF(JSON_CONTAINS(lc.package_list, CAST(lpl.id AS JSON)), 1, 0) AS exist` : `, 0 AS exist` }
                                    FROM tbl_lab_package_list AS lpl
                                    ${id != 0 ? `LEFT JOIN tbl_lab_cart AS lc ON lc.customer_id = '${id}' AND lc.lab_id = '${lab_id}'` : `` }
                                    WHERE lpl.lab_id = '${lab_id}' AND JSON_CONTAINS(lpl.category_list, '${category_id}', '$') AND lpl.status = '1';`);
        
        let cart_check = 0;

        pl.forEach(val => {
            let isStringName = typeof val.package_name === "string";
            let isStringPrice = typeof val.package_price === "string";
            let isIndividual = val.package_type === "Individual";

            let parsedName = isStringName ? JSON.parse(val.package_name) : val.package_name;
            let parsedPrice = isStringPrice ? JSON.parse(val.package_price) : val.package_price;

            val.package_name = parsedName.length;
            val.package_price = isIndividual ? parsedPrice[0] : parsedPrice.reduce((sum, item) => sum + item, 0);

            if (id != 0 && val.exist == 1) cart_check++;
        });


        const individual = pl.filter(val => val.package_type == "Individual");
        const package = pl.filter(val => val.package_type == "Package");

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', cart_check, individual, package });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/lab_package_details', async (req, res) => {
    try {
        const {package_id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["package_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        let pd = await DataFind(`SELECT id, logo, title, subtitle, description, home_extra_price, fasting_require, test_report_time, sample_type, package_type, 
                                    package_name, package_price, test_report_time, package_name, package_price, package_type
                                    FROM tbl_lab_package_list
                                    WHERE id = '${package_id}';`);

        if (pd != '') {
            pd[0].sample_type = typeof pd[0].sample_type == 'string' ? JSON.parse(pd[0].sample_type) : pd[0].sample_type; 
            pd[0].package_name = typeof pd[0].package_name == 'string' ? JSON.parse(pd[0].package_name) : pd[0].package_name; 
            pd[0].package_price = typeof pd[0].package_price == 'string' ? JSON.parse(pd[0].package_price) : pd[0].package_price; 
            pd[0].tot_price = pd[0].package_price.reduce((val, obj) => val + obj, 0);
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', package_data: pd != "" ? pd[0] : {}});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.post('/add_cart', async (req, res) => {
    try {
        const {id, lab_id, package_id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "lab_id", "package_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const bodygcheck = ["id", "lab_id", "package_id"].filter(bc => req.body[bc] == 0);
        if (bodygcheck.length > 0) return res.status(200).json({ ResponseCode: 401, Result:false, message: `Require ${ bodygcheck.join(", ") }` });

        const lc = await DataFind(`SELECT * FROM tbl_lab_cart WHERE customer_id = '${id}' AND lab_id = '${lab_id}'`);
        let pid = Number(package_id), pl = [];
        
        if (lc != '') {
            lc[0].package_list = typeof lc[0].package_list == "string" ? JSON.parse(lc[0].package_list) : lc[0].package_list;
            let packl = lc[0].package_list.findIndex(val => val == pid);
            if (packl != -1) {
                lc[0].package_list.splice(packl, 1);
                pl = lc[0].package_list;
            } else pl = [pid].concat(lc[0].package_list);
        } else pl.unshift(pid);
        
        if (lc != '') {
            if (pl != '') {
                if (await DataUpdate(`tbl_lab_cart`, `package_list = '${JSON.stringify(pl)}'`, `id = '${lc[0].id}'`, req.hostname, req.protocol) == -1) {
                    return res.status(200).json({ message: process.env.dataerror, status: false });
                }
            } else {
                if (await DataDelete(`tbl_lab_cart`, `id = '${lc[0].id}'`, req.hostname, req.protocol) == -1) {
                    return res.status(200).json({ message: process.env.dataerror, status: false });
                }
            }
        } else {
            if (await DataInsert(`tbl_lab_cart`, `customer_id, lab_id, package_list`, `'${id}', '${lab_id}', '${JSON.stringify(pl)}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status: false });
            }
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Lab package cart add successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


router.post('/package_cart', async (req, res) => {
    try {
        const {id, lab_id, category_id} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "lab_id", "category_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const cus = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${id}' AND status = '1'`);
        if (cus == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'User not found!' });

        const lc = await DataFind(`SELECT * FROM tbl_lab_cart WHERE customer_id = '${id}' AND lab_id = '${lab_id}'`);
        if (lc == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Please select package!' });
        lc[0].package_list = typeof lc[0].package_list == "string" ? JSON.parse(lc[0].package_list) : lc[0].package_list;

        const rd = await AllFunction.LabReviewCalculate('lab');
        const lab = await DataFind(`SELECT lab.id, lab.logo, lab.name, lab.license_number, lab.address
                                    ${rd.tot_review} ${rd.avgstar}
                                    FROM tbl_lab_list AS lab
                                    ${rd.table}
                                    WHERE lab.id = '${lab_id}' AND lab.status = '1'`);
        
        if (lab == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Lab not found!' });
        
        let home_extra_price = 0;
        const pd = await DataFind(`SELECT id, logo, title, subtitle, description, home_extra_price, fasting_require, test_report_time, sample_type, package_name, package_price
                                    FROM tbl_lab_package_list
                                    WHERE id IN (${lc[0].package_list.join(",")}) AND status = '1'`);

        if (pd == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data not found!' });
        pd.map(val => {
            val.sample_type = typeof val.sample_type == "string" ? JSON.parse(val.sample_type) : val.sample_type;
    
            val.package_name = typeof val.package_name == "string" ? 
                                ( val.package_type == "Individual" ? JSON.parse(val.package_name).length : JSON.parse(val.package_name).length ) :
                                ( val.package_type == "Individual" ? val.package_name.length : val.package_name.length );
            
            val.package_price = typeof val.package_price == "string" ?
                                ( val.package_type == "Individual" ? JSON.parse(val.package_price)[0] : JSON.parse(val.package_price).reduce((val, obj) => val + obj, 0) ) :
                                ( val.package_type == "Individual" ? val.package_price[0] : val.package_price.reduce((val, obj) => val + obj, 0) );

            home_extra_price += val.home_extra_price;
        });

        const category = await DataFind(`SELECT id, image, name FROM tbl_lab_category WHERE id = '${category_id}' AND status = '1';`);
        if (category == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data not found!' });
        
        const family_member = await DataFind(`SELECT * FROM tbl_family_member WHERE customer_id = '${id}'`);

        const commission_data = await DataFind(`SELECT commission_rate, commisiion_type FROM tbl_general_settings`);
        
        let wallet_amount = 0;
        if (cus[0].tot_balance < 0) {
            if (await DataUpdate(`tbl_customer`, `tot_balance = '0'`, `id = '${cus[0].id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }
            wallet_amount = 0;
        } else wallet_amount = cus[0].tot_balance;
        
        const date = new Date().toISOString().split("T");
        const coupon = await DataFind(`SELECT id, title, sub_title, code, min_amount, discount_amount, start_date, end_date
                                        FROM tbl_lab_coupon WHERE lab_id = '${lab_id}' AND start_date <= '${date[0]}' AND end_date >= '${date[0]}'`);
        
        coupon.map(cval => {
            cval.start_date = new Date(cval.start_date).toISOString().split("T")[0];
            cval.end_date = new Date(cval.end_date).toISOString().split("T")[0];
        });

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', wallet_amount, home_extra_price, 
            commission_data: commission_data != '' ? commission_data[0] : [], lab:lab[0], category: category[0], package_detail:pd, family_member, coupon });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





router.post('/add_lab_book', async (req, res) => {
    const {id, lab_id, category_id, date, time, message, address, package_list, family_mem_id, tot_price, tot_package_price, home_extra_price, coupon_id, coupon_amount, 
        site_commission, payment_id, wallet_amount, home_col_status, transactionId} = req.body;

    const missingField = await AllFunction.BodyDataCheck(["id", "lab_id", "category_id", "date", "time", "package_list", "family_mem_id"], req.body);
    if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

    // console.log(req.body);
    
    const customer = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${id}' AND status = '1'`);
    if (customer == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'User not found!' });
    
    let pcheck = 0, book_date = new Date().toISOString(), paid_amount = tot_price, bookapp = 0, tot_amount = 0;
    if (payment_id == '16') paid_amount = wallet_amount;

    try {
        for (let a = 0; a < package_list.length;) {
            if (package_list[a].f.length == 0) pcheck++;
            a++;
        }
        if (pcheck > 0) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Please add family member!' });


        if (wallet_amount > 0) {
            tot_amount = customer[0].tot_balance - Number(wallet_amount);
            if (tot_amount < 0) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Invalid user wallet amount!' });
        }

        const pc = await DataFind(`SELECT * FROM tbl_lab_cart WHERE customer_id = '${id}' AND lab_id = '${lab_id}'`);
        if (pc == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Please select package!' });
        pc[0].package_list = typeof pc[0].package_list == "string" ? JSON.parse(pc[0].package_list) : pc[0].package_list;


        package_list.map(v => {
            v.f = v.f.map(f => {
                return {id: f, r: [], c: '', d:''};
            });
        });

        const status_list = [{ s:1, t: new Date().toISOString() }];
        
        bookapp = await DataInsert(`tbl_lab_booking`, `customer_id, lab_id, package_id, category_id, status, status_list, date, book_date, book_time, message, address, 
            family_mem_id, tot_price, paid_amount, tot_package_price, coupon_id, coupon_amount, home_extra_price, home_col_status, home_collect_user_id, site_commission, payment_id, 
            wallet_amount, otp, cancel_id, cancel_reason, transactionId`,
            `'${id}', '${lab_id}', '${JSON.stringify(package_list)}', '${category_id}', '1', '${JSON.stringify(status_list)}', '${book_date}', '${date}', '${time}', '${message}', 
            '${address}', '${JSON.stringify(family_mem_id)}', '${tot_price}', '${paid_amount}', '${tot_package_price}', '${coupon_id}', '${coupon_amount}', '${home_extra_price}', 
            '${home_col_status}', '', '${site_commission}', '${payment_id}', '${wallet_amount}', '', '', '', '${transactionId}'`, req.hostname, req.protocol);
        
        if (bookapp == -1) return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });

        if (wallet_amount > 0) {
            
            if (await DataUpdate(`tbl_customer`, `tot_balance = '${tot_amount}'`, `id = '${customer[0].id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }

            if (await DataInsert(`tbl_customer_wallet`, `customer_id, amount, date, payment_type, status, amount_type`,
                `'${customer[0].id}', '${wallet_amount}', '${book_date.split("T")[0]}', '0', '6', '${bookapp.insertId}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }
        }

        if (await DataDelete(`tbl_lab_cart`, `customer_id = '${id}' AND lab_id = '${lab_id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        let ms = `🕒 Your lab appointment request has been received and is pending confirmation. Appointment ID : # ${bookapp.insertId}`;
        sendOneNotification(ms, 'customer', id, 1);
        sendOneNotification(ms, 'customer', id, 2);
        sendOneNotification(`Received new appointment. Appointment ID : # ${bookapp.insertId}`, 'lab', lab_id, 1);
        if (await DataInsert(`tbl_notification`, `order_id, customer_id, service_user_id, date, mstatus, ostatus, notification`,
            `'${bookapp.insertId}', '${id}', '${lab_id}', '${AllFunction.NotificationDate(date)}', '2', '1', '${ms}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Lab package book successful' });

    } catch (error) {

        if (paid_amount > 0 && customer != '') {
            // console.log(222);
            const tot_amount = customer[0].tot_balance + paid_amount;

            if (await DataUpdate(`tbl_customer`, `tot_balance = '${tot_amount}'`, `id = '${customer[0].id}'`, hostname, protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }

            if (await DataInsert(`tbl_customer_wallet`, `customer_id, amount, date, payment_type, status, amount_type`,
                `'${customer[0].id}', '${paid_amount}', '${new Date().toISOString().split("T")[0]}', '0', '11', '${payment_id}'`, hostname, protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }
        }

        if (bookapp != 0) {
            // console.log(333);
            if (await DataDelete(`tbl_lab_booking`, `id = '${bookapp.insertId}'`, hostname, protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }
        }

        console.error(error);
        res.status(500).json({ Result: false, error: 'Internal server error' });
    }
});

router.post('/lab_booking_list', async (req, res) => {
    try {
        const {id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });
        
        const lb = await DataFind(`SELECT lb.id, lb.date, lb.tot_price, lb.status, COALESCE(ll.logo, '') AS lab_logo, COALESCE(ll.name, '') AS name, 
                                    COALESCE(ll.country_code, '') AS country_code, COALESCE(ll.phone, '') AS phone,
                                    CASE 
                                        WHEN lb.status = '1' THEN 'Pending'
                                        WHEN lb.status = '2' THEN 'Accepted'
                                        WHEN lb.status = '3' THEN 'Assign Collector'
                                        WHEN lb.status = '4' THEN 'Ongoing'
                                        WHEN lb.status = '5' THEN 'In Progress'
                                        WHEN lb.status = '6' THEN 'Completed'
                                        WHEN lb.status = '7' THEN 'Canceled'
                                    END AS status_type
                                    FROM tbl_lab_booking AS lb
                                    LEFT JOIN tbl_lab_list AS ll ON ll.id = lb.lab_id
                                    WHERE customer_id = '${id}'`);
        
        if (lb == '') return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data not found!', lab_pending_list: [], lab_complete_list: [] });
        
        const lbl = lb.map(val => ({
            ...val,
            date: new Date(val.date).toLocaleString('en-US', {
                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone 
            })
        }));

        const lab_pending_list = [...lbl].filter(val =>  ["Pending", "Accepted", "Assign Collector", "Ongoing", "In Progress"].includes(val.status_type)).reverse();
        const lab_complete_list = [...lbl].filter(val => ["Completed", "Canceled"].includes(val.status_type)).reverse();
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Lab package book successful', lab_pending_list, lab_complete_list });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/lab_booking_detail', async (req, res) => {
    try {
        const {id, lab_book_id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "lab_book_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const appoint = await DataFind(`SELECT 
                                        lb.id, lb.customer_id, lb.lab_id, lb.category_id, lb.status, lb.date, lb.book_date, lb.book_time, lb.message, lb.address, 
                                        lb.family_mem_id, lb.tot_price, lb.tot_package_price, lb.paid_amount, lb.coupon_id, lb.coupon_amount, 
                                        lb.home_extra_price, lb.home_col_status, lb.site_commission, lb.payment_id, lb.wallet_amount, lb.otp, 0 AS online_amount, 0 AS cash_amount,
                                        COALESCE(pd.name, '') AS payment_name, COALESCE(pd.image, '') AS payment_image,
                                        CASE WHEN COUNT(lr.id) > 0 THEN '1' ELSE '0' END AS review_check,
                                        COALESCE(lhcu.name, '') AS home_c_user, COALESCE(lhcu.email, '') AS home_c_email, COALESCE(lhcu.country_code, '') AS home_c_ccode,
                                        COALESCE(lhcu.phone, '') AS home_c_phone,
                                        CASE 
                                            WHEN lb.status = '1' THEN 'Pending'
                                            WHEN lb.status = '2' THEN 'Accepted'
                                            WHEN lb.status = '3' THEN 'Assign Collector'
                                            WHEN lb.status = '4' THEN 'Ongoing'
                                            WHEN lb.status = '5' THEN 'In Progress'
                                            WHEN lb.status = '6' THEN 'Completed'
                                            WHEN lb.status = '7' THEN 'Canceled'
                                        END AS status_type,
                                        COALESCE(cl.title, '') AS cancel_title, COALESCE(lb.cancel_reason, '') AS cancel_reason, lb.transactionId, '' AS qrcode, lb.status_list,
                                        JSON_ARRAYAGG(
                                            JSON_OBJECT(
                                                'pid', p.pid, 
                                                'logo', pkg.logo,
                                                'title', pkg.title,
                                                'subtitle', pkg.subtitle,
                                                'description', pkg.description,
                                                'home_extra_price', pkg.home_extra_price,
                                                'fasting_require', pkg.fasting_require,
                                                'test_report_time', pkg.test_report_time,
                                                'sample_type', pkg.sample_type,
                                                'package_name', pkg.package_name,
                                                'package_price', pkg.package_price,
                                                'package_type', pkg.package_type,
                                                'f', (
                                                    SELECT JSON_ARRAYAGG(
                                                        JSON_OBJECT(
                                                            'c', f.c,
                                                            'd', f.d,
                                                            'r', f.r, 
                                                            'fmember', JSON_OBJECT(
                                                                'id', fm.id, 
                                                                'profile_image', fm.profile_image,
                                                                'name', fm.name
                                                            )
                                                        )
                                                    )
                                                    FROM JSON_TABLE(p.f, '$[*]' COLUMNS(
                                                        id INT PATH '$.id',
                                                        c VARCHAR(255) PATH '$.c',
                                                        d VARCHAR(255) PATH '$.d',
                                                        r JSON PATH '$.r'
                                                    )) AS f
                                                    JOIN tbl_family_member fm ON f.id = fm.id
                                                )
                                            )
                                        ) AS package_id
                                        FROM tbl_lab_booking AS lb
                                        JOIN JSON_TABLE(lb.package_id, '$[*]' COLUMNS(
                                            pid INT PATH '$.pid',
                                            f JSON PATH '$.f'
                                        )) AS p
                                        LEFT JOIN tbl_lab_package_list pkg ON p.pid = pkg.id
                                        LEFT JOIN tbl_payment_detail AS pd ON pd.id = lb.payment_id
                                        LEFT JOIN tbl_lab_reviews AS lr ON lr.booking_id = lb.id AND lr.customer_id = lb.customer_id
                                        LEFT JOIN tbl_appointment_cancel_list AS cl ON cl.id = lb.cancel_id AND lb.cancel_id != ''
                                        LEFT JOIN tbl_lab_home_collect_user AS lhcu ON lhcu.id = lb.home_collect_user_id
                                        WHERE lb.id = '${lab_book_id}' AND lb.customer_id = '${id}'
                                        GROUP BY lb.id HAVING lb.id IS NOT NULL;`);
        
        if (appoint == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Appointment not found!' });

        appoint[0].package_id = typeof appoint[0].package_id == 'string' ? JSON.parse(appoint[0].package_id) : appoint[0].package_id;
        appoint[0].status_list = typeof appoint[0].status_list == 'string' ? JSON.parse(appoint[0].status_list) : appoint[0].status_list;

        appoint[0].package_id.map(p => {
            p.sample_type = typeof p.sample_type == 'string' ? JSON.parse(p.sample_type) : p.sample_type;
            p.package_name = typeof p.package_name == 'string' ? JSON.parse(p.package_name) : p.package_name;
            p.package_price = typeof p.package_price == 'string' ? JSON.parse(p.package_price) : p.package_price;

            p.tot_package_name = p.package_type == "Individual" ? p.package_name.length : p.package_name.length;
            p.tot_package_price = p.package_type == "Individual" ? p.package_price[0] : p.package_price.reduce((p, obj) => p + obj, 0);

            p.f.map(pv => {
                if (pv.d != '') pv.d = new Date(appoint[0].date).toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
            });
        });

        appoint[0].status_list.map(p => {
            p.t = new Date(p.t).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
        });

        const date = new Date(appoint[0].date);
        const formattedDate = date.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
        appoint[0].date = formattedDate;

        if (appoint[0].otp != '') {
            const qrdata = {id: appoint[0].id, otp: appoint[0].otp};
            appoint[0].qrcode = await QRCode.toDataURL(`${JSON.stringify(qrdata)}`);
        }

        if (appoint[0].payment_name != 'Cash') appoint[0].online_amount = Number((appoint[0].tot_price - appoint[0].wallet_amount).toFixed(2));
        else appoint[0].online_amount = 0;

        if (appoint[0].payment_name == 'Cash') appoint[0].cash_amount = Number((appoint[0].tot_price - appoint[0].paid_amount).toFixed(2));

        

        const rd = await AllFunction.LabReviewCalculate('lab');
        const lab = await DataFind(`SELECT lab.id, lab.logo, lab.name, lab.license_number, lab.address, lab.latitude, lab.longitude
                                    ${rd.tot_review} ${rd.avgstar}
                                    FROM tbl_lab_list AS lab
                                    ${rd.table}
                                    WHERE lab.id = '${appoint[0].lab_id}' AND lab.status = '1'`);
        
        if (lab == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Lab not found!' });

        const category = await DataFind(`SELECT id, image, name FROM tbl_lab_category WHERE id = '${appoint[0].category_id}' AND status = '1';`);
        
        delete appoint[0].pid_list; delete appoint[0].family_mem_id;

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Lab package book successful', appoint: appoint[0], lab: lab != '' ? lab[0] : {}, 
            category: category[0] || {}});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/cancel_lab_appointment', async (req, res) => {
    try {
        const {id, lab_book_id, reason_id, reason} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "lab_book_id", "reason_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const appont = await DataFind(`SELECT id, customer_id, otp, status, status_list, paid_amount FROM tbl_lab_booking WHERE id = '${lab_book_id}' AND customer_id = '${id}'`);                    
        if (appont == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Appointment not found!' });
        appont[0].status_list = typeof appont[0].status_list == "string" ? JSON.parse(appont[0].status_list) : appont[0].status_list;

        if (appont[0].status != 1) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Appointment already rejected!' });

        let date = new Date();
        appont[0].status_list.unshift({ s:7, t: date.toISOString() });

        const customer = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${appont[0].customer_id}'`);

        if (appont[0].paid_amount > 0 && customer != '') {
            const tot_amount = customer[0].tot_balance + appont[0].paid_amount;
            
            if (await DataUpdate(`tbl_customer`, `tot_balance = '${tot_amount}'`, `id = '${customer[0].id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }

            if (await DataInsert(`tbl_customer_wallet`, `customer_id, amount, date, payment_type, status, amount_type`,
                `'${customer[0].id}', '${appont[0].paid_amount}', '${date.toISOString().split("T")[0]}', '0', '5', '${lab_book_id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }
        }

        if (await DataUpdate(`tbl_lab_booking`, `status = '7', otp = '', status_list = '${JSON.stringify(appont[0].status_list)}', cancel_id = '${reason_id}',
            cancel_reason = ${mysql.escape(reason)}`,
            `id = '${appont[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        let ms = `❌ Your lab appointment has been cancelled. For further details, please contact support. Appointment ID : # ${appont[0].id}`
        sendOneNotification(ms, 'customer', appont[0].customer_id, 1);
        sendOneNotification(ms, 'customer', appont[0].customer_id, 2);
        if (await DataInsert(`tbl_notification`, `order_id, customer_id, service_user_id, date, mstatus, ostatus, notification`,
            `'${appont[0].id}', '${appont[0].customer_id}', '${appont[0].lab_id}', '${AllFunction.NotificationDate(date)}', '2', '7', '${ms}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Lab appointment cancel successful.'});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/referral_data', async (req, res) => {
    try {
        const {id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const appont = await DataFind(`SELECT referral_code FROM tbl_customer WHERE id = '${id}'`);                    
        const gd = await DataFind(`SELECT signup_credit, refer_credit FROM tbl_general_settings`);  
        if (appont == '' || gd == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data not found!' });
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Referral data load.', fererral_data: {...appont[0], ...gd[0]}});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/notification_list', async (req, res) => {
    try {
        const {id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const nlist = await DataFind(`SELECT noti.*,
                                        IFNULL(
                                            CASE
                                                WHEN noti.mstatus = '1' THEN doc.name
                                                WHEN noti.mstatus = '2' THEN lab.name
                                                WHEN noti.mstatus = '3' THEN doc.name
                                                ELSE ''
                                            END, ''
                                        ) AS service_uname
                                        FROM tbl_notification AS noti
                                        LEFT JOIN tbl_doctor_list AS doc ON doc.id = noti.service_user_id
                                        LEFT JOIN tbl_lab_list AS lab ON lab.id = noti.service_user_id
                                        WHERE noti.customer_id = '${id}'`);
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', nlist});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/faq_list', async (req, res) => {
    try {
        const faq_list = await DataFind(`SELECT * FROM tbl_list_faq`);
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'FAQ load successful', faq_list});
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

        const customer = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${id}'`);
         if (customer == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'User not found!' });
        
        if (await DataUpdate(`tbl_customer`, `status = '0'`, `id = '${customer[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Account Deleted Successfully'});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



module.exports = router;
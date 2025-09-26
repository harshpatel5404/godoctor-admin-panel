/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */


const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const multer  = require('multer');
let mysql = require('mysql2');
const bcrypt = require('bcrypt');
const countryCodes = require('country-codes-list');
const AllFunction = require("../route_function/function");
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/database_query");



// ============= Doctor ================ //

router.get("/add", auth, async(req, res)=>{
    try {
        const Country_name = countryCodes.customList('countryCode', '{countryCode}');
        const nameCode = Object.values(Country_name);
        const myCountryCodesObject = countryCodes.customList('countryCode', '+{countryCallingCode}');
        const CountryCode = Object.values(myCountryCodesObject);
        const department_list = await DataFind(`SELECT * FROM tbl_department_list WHERE status = '1' ORDER BY id DESC`);
        const hospital_list = await DataFind(`SELECT * FROM tbl_hospital_list WHERE status = '1' ORDER BY id DESC`);

        res.render("add_doctor", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, nameCode, CountryCode, department_list,
            hospital_list
        })
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/check_doctor_detail", auth, async(req, res)=>{
    try {
        const {email, country_code, phone, lat, lon} = req.body;

        let check_email = true, check_mobileno = true, zonec = true;

        if (lat != '' && lon != '') {
            const zonecec = await DataFind(`SELECT zon.name AS zone_name
                                            FROM tbl_zone AS zon
                                            WHERE zon.status = '1'
                                            AND ST_Contains(
                                                zon.lat_lon_polygon,
                                                ST_SRID(ST_GeomFromText(CONCAT('POINT(', ${Number(lon)}, ' ', ${Number(lat)}, ')')), 4326)
                                            );`);
    
            if (zonecec == '') zonec = false;
        }
        
        if (email != '') {
            const emailExists = await DataFind(`SELECT email FROM tbl_doctor_list WHERE email = '${email}'
                                                UNION SELECT email FROM tbl_lab_list WHERE email = '${email}'
                                                UNION SELECT email FROM tbl_role_permission WHERE email = '${email}'
                                                UNION SELECT email FROM tbl_admin WHERE email = '${email}'`);

            if (emailExists != '') check_email = false;
            else  check_email = true;
        }

        if (country_code != '' && phone != '') {
            const phoneExists = await DataFind(`SELECT phone FROM tbl_doctor_list WHERE country_code = '${country_code}' AND phone = '${phone}'
                                                UNION SELECT phone FROM tbl_lab_list WHERE country_code = '${country_code}' AND phone = '${phone}'
                                                UNION SELECT phone FROM tbl_doctor_receptionist WHERE country_code = '${country_code}' AND phone = '${phone}'
                                                UNION SELECT phone FROM tbl_role_permission WHERE country_code = '${country_code}' AND phone = '${phone}'
                                                UNION SELECT phone FROM tbl_admin WHERE country_code = '${country_code}' AND phone = '${phone}'`);

            if (phoneExists != '') check_mobileno = false;
            else  check_mobileno = true;
        }

        res.send({check_email, check_mobileno, zonec});
    } catch (error) {
        console.log(error);
    }
});

const cusImage = `./public/uploads/doctor`;
AllFunction.ImageUploadFolderCheck(cusImage);
const storage1 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/doctor");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const doctor = multer({storage : storage1});

router.post("/add_doctor_data", auth, doctor.fields([{name: 'logo', maxCount: 1}, {name: 'cover_logo', maxCount: 1}]), async(req, res)=>{
    try {
        const {name, status, country_code, phone, title, subtitle, description, cancel_policy, email, password, address, pincode, landmark, zone, latitude, longitude, commisiion,
            v_status, hospital_list, department_list, year_of_experience} = req.body;

        
        let hos_list = [], dep_list, vs = 0;

        if (typeof hospital_list == "string") hos_list = [hospital_list].map(v => Number(v));
        else hos_list = [...hospital_list].map(v => Number(v));

        if (typeof department_list == "string") dep_list = [department_list].map(v => Number(v));
        else dep_list = [...department_list].map(v => Number(v));
        
        if (v_status == "0") {
            const gs = await DataFind(`SELECT doctor_auto_approve FROM tbl_general_settings`);
            if (gs != '') {
                if (gs[0].doctor_auto_approve > 0 && !isNaN(gs[0].doctor_auto_approve)) {
                    vs = gs[0].doctor_auto_approve
                }
            } 
        } else vs = v_status;

        const logo = req.files.logo ? "uploads/doctor/" + req.files.logo[0].filename : null;
        const cover_logo = req.files.cover_logo ? "uploads/doctor/" + req.files.cover_logo[0].filename : null;

        const hash = await bcrypt.hash(password, 10), sit_title = mysql.escape(title), sit_subtitle = mysql.escape(subtitle), sit_destitle = mysql.escape(description), 
            sit_cantitle = mysql.escape(cancel_policy), sit_addtitle = mysql.escape(address);

        const sitterid = await DataInsert(`tbl_doctor_list`, `logo, cover_logo, name, email, country_code, phone, password, status, verification_status, per_patient_time, title, 
            subtitle, year_of_experience, description, cancel_policy, address, pincode, landmark, tot_favorite, latitude, longitude, commission, hospital_list, department_list, wallet, 
            cash_amount, success_cash, tot_payout, success_payout, medicine_payout, success_medicine_payout, join_date`,
            `'${logo}', '${cover_logo}', '${name}', '${email}', '${country_code}', '${phone}', '${hash}', '${status}', '${vs}', '0', ${sit_title}, ${sit_subtitle}, 
            '${year_of_experience}', ${sit_destitle}, ${sit_cantitle}, ${sit_addtitle}, '${pincode}', '${landmark}', '0', '${latitude}', '${longitude}', '${commisiion}', 
            '${JSON.stringify(hos_list)}', '${JSON.stringify(dep_list)}', '0', '0', '0', '0', '0', '0', '0', '${new Date().toISOString().split("T")[0]}'`, 
            req.hostname, req.protocol);

        if (sitterid == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        if (await DataInsert(`tbl_doctor_setting`, `doctor_id, sign_image, extra_patient_charge, defaultm`, `'${sitterid.insertId}', '', '0', ''`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        for (let i = 0; i < hos_list.length;){
            if (await DataInsert(`tbl_doctor_hos_time`, `doctor_id, hospital_id, date_time_list, book_time_list`, 
                `'${sitterid.insertId}', '${hos_list[i]}', '[]', '[]'`, req.hostname, req.protocol) == -1) {
                
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }

            for (let a = 0; a < dep_list.length;) {
                console.log(`hos :- ${hos_list[i]},    dep list :- ${dep_list[a]}`);
                
                if (await DataInsert(`tbl_doctor_hos_depart_list`, `doctor_id, hospital_id, department_id, sub_title, image, client_visit_price, video_consult_price, show_type, status`, 
                    `'${sitterid.insertId}', '${hos_list[i]}', '${dep_list[a]}', '', '', '0', '0', '0', '0'`, req.hostname, req.protocol) == -1) {
                    
                    req.flash('errors', process.env.dataerror);
                    return res.redirect("/valid_license");
                }
                a++;
            }
            i++;
        }
        
        req.flash('success', 'Department Add successfully');
        res.redirect("/doctor/list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
})

router.get("/list", auth, async(req, res)=>{
    try {
        const dector_list = await DataFind(`SELECT id, logo, name, email, country_code, phone, status, verification_status FROM tbl_doctor_list 
            WHERE logo NOT IN ("") AND name NOT IN ("") AND email NOT IN ("") AND title NOT IN ("") AND address NOT IN ("") AND latitude NOT IN (0) AND longitude NOT IN (0)
            ORDER BY id DESC`);
        
        res.render("list_doctor", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, dector_list
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/edit/:id", auth, async(req, res)=>{
    try {
        const Country_name = countryCodes.customList('countryCode', '{countryCode}');
        const nameCode = Object.values(Country_name);
        const myCountryCodesObject = countryCodes.customList('countryCode', '+{countryCallingCode}');
        const CountryCode = Object.values(myCountryCodesObject);
        const department_list = await DataFind(`SELECT * FROM tbl_department_list WHERE status = '1' ORDER BY id DESC`);
        const hospital_list = await DataFind(`SELECT * FROM tbl_hospital_list WHERE status = '1' ORDER BY id DESC`);

        const dector = await DataFind(`SELECT * FROM tbl_doctor_list WHERE id = '${req.params.id}'`);
        if (dector == '') {
            req.flash('errors', `Data not Added`);
            return res.redirect("back");
        }

        const hos_dep = await DataFind(`SELECT
                                        (
                                            SELECT COALESCE(JSON_ARRAYAGG(CAST(hospital_id AS UNSIGNED)), JSON_ARRAY())
                                            FROM (
                                                SELECT DISTINCT hospital_id
                                                FROM tbl_doctor_hos_depart_list
                                                WHERE doctor_id = '${req.params.id}'
                                            ) AS h
                                        )   AS hospital_ids,
                                        (
                                            SELECT COALESCE(JSON_ARRAYAGG(CAST(department_id AS UNSIGNED)), JSON_ARRAY())
                                            FROM (
                                                SELECT DISTINCT department_id
                                                FROM tbl_doctor_hos_depart_list
                                                WHERE doctor_id = '${req.params.id}'
                                            ) AS d
                                        ) AS department_ids;`);

        const serd = await DataFind(`SELECT hos_dep.id, hos_dep.hospital_id, hos_dep.department_id, hos_dep.sub_title, hos_dep.image, hos_dep.client_visit_price, 
                                    hos_dep.video_consult_price, hos_dep.show_type, hos_dep.status, COALESCE(hos.name) AS hospital_name, COALESCE(dep.name) AS depart_name
                                    FROM tbl_doctor_hos_depart_list AS hos_dep
                                    LEFT JOIN tbl_hospital_list AS hos on hos.id =  hos_dep.hospital_id
                                    LEFT JOIN tbl_department_list AS dep on dep.id =  hos_dep.department_id
                                    where doctor_id = '${dector[0].id}' ${ hos_dep[0].hospital_ids.length > 0 ? `AND hospital_id IN (${hos_dep[0].hospital_ids.join(",")})` : ``} `);
        
        res.render("edit_doctor", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, nameCode, CountryCode, department_list, 
            hospital_id_list:hos_dep[0].hospital_ids, serd, hospital_list, dec: dector[0], dids: hos_dep[0].department_ids
        })
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/edit_doctor_data/:id", auth, doctor.fields([{name: 'logo', maxCount: 1}, {name: 'cover_logo', maxCount: 1}]), async(req, res)=>{
    try {
        const {name, status, country_code, phone, title, subtitle, description, cancel_policy, email, password, address, pincode, landmark, zone, latitude, longitude, commisiion,
            v_status, hospital_list, department_list, year_of_experience} = req.body;
        
        const dector = await DataFind(`SELECT * FROM tbl_doctor_list WHERE id = '${req.params.id}'`);
        
        if (dector != '') {
            let hos_list = [], dep_list, logo = '', cover_logo = '', vs = 0;
    
            if (typeof hospital_list == "string") hos_list = [hospital_list].map(v => Number(v));
            else hos_list = [...hospital_list].map(v => Number(v));
    
            if (typeof department_list == "string") dep_list = [department_list].map(v => Number(v));
            else dep_list = [...department_list].map(v => Number(v));

            if (req.files) {
                if (req.files.logo) {
                    await AllFunction.DeleteImage(dector[0].logo);
                    logo = "uploads/doctor/" + req.files.logo[0].filename;
                } else logo = dector[0].logo;

                if (req.files.cover_logo) {
                    await AllFunction.DeleteImage(dector[0].cover_logo);
                    cover_logo = "uploads/doctor/" + req.files.cover_logo[0].filename;
                } else cover_logo = dector[0].cover_logo;
            }

            if (v_status == "0") {
                const gs = await DataFind(`SELECT doctor_auto_approve FROM tbl_general_settings`);
                if (gs != '') {
                    if (gs[0].doctor_auto_approve > 0 && !isNaN(gs[0].doctor_auto_approve)) {
                        vs = gs[0].doctor_auto_approve
                    }
                } 
            } else vs = v_status;
             
            const hash = password != '' ? await bcrypt.hash(password, 10) : dector[0].password, sit_title = mysql.escape(title), sit_subtitle = mysql.escape(subtitle), 
                        sit_destitle = mysql.escape(description), sit_cantitle = mysql.escape(cancel_policy), sit_addtitle = mysql.escape(address);
    
            await DataUpdate(`tbl_doctor_list`, `logo = '${logo}', cover_logo = '${cover_logo}', name = '${name}', email = '${email}', country_code = '${country_code}', 
                phone = '${phone}', password = '${hash}', status = '${status}', verification_status = '${vs}', title = ${sit_title}, subtitle = ${sit_subtitle}, 
                year_of_experience = '${year_of_experience}', description = ${sit_destitle}, cancel_policy = ${sit_cantitle}, 
                address = ${sit_addtitle}, pincode = '${pincode}', landmark = '${landmark}', latitude = '${latitude}', longitude = '${longitude}', commission = '${commisiion}',
                hospital_list = '${JSON.stringify(hos_list)}', department_list = '${JSON.stringify(dep_list)}'`,
                `id = '${req.params.id}'`, req.hostname, req.protocol);
              
            const hos_dep = await DataFind(`SELECT
                                            (
                                                SELECT COALESCE(JSON_ARRAYAGG(CAST(hospital_id AS UNSIGNED)), JSON_ARRAY())
                                                FROM (
                                                    SELECT DISTINCT hospital_id
                                                    FROM tbl_doctor_hos_depart_list
                                                    WHERE doctor_id = '${dector[0].id}'
                                                ) AS h
                                            )   AS hospital_ids,
                                            (
                                                SELECT COALESCE(JSON_ARRAYAGG(CAST(department_id AS UNSIGNED)), JSON_ARRAY())
                                                FROM (
                                                    SELECT DISTINCT department_id
                                                    FROM tbl_doctor_hos_depart_list
                                                    WHERE doctor_id = '${dector[0].id}'
                                                ) AS d
                                            ) AS department_ids;`);

            if (hos_dep != '') {
                const rhlist = hos_dep[0].hospital_ids.filter(h => hos_list.includes(h) === false);
                for (const rh of rhlist) {
                    if (await DataDelete(`tbl_doctor_hos_time`, `doctor_id = '${dector[0].id}' AND hospital_id = '${rh}'`, req.hostname, req.protocol) == -1) {
                        req.flash('errors', process.env.dataerror);
                        return res.redirect("/valid_license");
                    }

                    const dhd = await DataFind(`SELECT id, image FROM tbl_doctor_hos_depart_list WHERE doctor_id = '${dector[0].id}' AND hospital_id = '${rh}'`);
                    if (dhd != '') { 
                        await AllFunction.DeleteImage(dhd[0].image);    
                        if (await DataDelete(`tbl_doctor_hos_depart_list`, `id = '${dhd[0].id}'`, req.hostname, req.protocol) == -1) {
                            req.flash('errors', process.env.dataerror);
                            return res.redirect("/valid_license");
                        }
                    }

                };

                const nhlist = hos_list.filter(h => hos_dep[0].hospital_ids.includes(h) === false);
                for (const nh of nhlist) {
                    if (await DataInsert(`tbl_doctor_hos_time`, `doctor_id, hospital_id, date_time_list, book_time_list`, 
                        `'${dector[0].id}', '${nh}', '[]', '[]'`, req.hostname, req.protocol) == -1) {
                        
                        req.flash('errors', process.env.dataerror);
                        return res.redirect("/valid_license");
                    }

                    dep_list.forEach(async (dl) => {
                        if (await DataInsert(`tbl_doctor_hos_depart_list`, `doctor_id, hospital_id, department_id, sub_title, image, client_visit_price, video_consult_price, show_type, status`, 
                            `'${dector[0].id}', '${nh}', '${dl}', '', '', '0', '0', '0', '0'`, req.hostname, req.protocol) == -1) {
                        
                            req.flash('errors', process.env.dataerror);
                            return res.redirect("/valid_license");
                        }
                    });
                };

                const rdlist = hos_dep[0].department_ids.filter(h => dep_list.includes(h) === false);
                for (const rd of rdlist) {
                    const dhd = await DataFind(`SELECT id, image FROM tbl_doctor_hos_depart_list WHERE doctor_id = '${dector[0].id}' AND department_id = '${rd}'`);
                    if (dhd != '') { 
                        await AllFunction.DeleteImage(dhd[0].image);    
                        if (await DataDelete(`tbl_doctor_hos_depart_list`, `id = '${dhd[0].id}'`, req.hostname, req.protocol) == -1) {
                            req.flash('errors', process.env.dataerror);
                            return res.redirect("/valid_license");
                        }
                    }
                };

                const ndlist =  dep_list.filter(h => hos_dep[0].department_ids.includes(h) === false);
                for (const nd of ndlist) {
                    hos_list.forEach(async (hl) => {
                        if (await DataInsert(`tbl_doctor_hos_depart_list`, `doctor_id, hospital_id, department_id, sub_title, image, client_visit_price, video_consult_price, show_type, status`, 
                            `'${dector[0].id}', '${hl}', '${nd}', '', '', '0', '0', '0', '0'`, req.hostname, req.protocol) == -1) {
                         
                            req.flash('errors', process.env.dataerror);
                            return res.redirect("/valid_license");
                        }
                    });
                };
            }
            
            req.flash('success', 'Doctor Detail Edit successfully');
        } else req.flash('success', 'Doctor Detail Edit successfully');
        
        res.redirect("/doctor/list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
})

router.get("/delete/:id", auth, async(req, res)=>{
    try {
        const doc = await DataFind(`SELECT * FROM tbl_doctor_list WHERE id = '${req.params.id}'`);

        if (doc != '') {
            await AllFunction.DeleteImage(doc[0].logo);
            await AllFunction.DeleteImage(doc[0].cover_logo);
            if (await DataDelete(`tbl_doctor_list`, `id = '${doc[0].id}'`, req.hostname, req.protocol) == -1) {
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
        }
        
        req.flash('success', 'Doctor Deleted successfully');
        res.redirect("/doctor/list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
})





module.exports = router;
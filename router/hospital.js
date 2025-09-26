/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */


const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const multer  = require('multer');
let mysql = require('mysql2');
const countryCodes = require('country-codes-list');
const AllFunction = require("../route_function/function");
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/database_query");






// ============= Hospital ================ //


const cusImage = `./public/uploads/hospital`;
AllFunction.ImageUploadFolderCheck(cusImage);
const storage1 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/hospital");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const hospital = multer({storage : storage1});

router.get("/add", auth, async(req, res)=>{
    try {
        const Country_name = countryCodes.customList('countryCode', '{countryCode}');
        const nameCode = Object.values(Country_name);
        const myCountryCodesObject = countryCodes.customList('countryCode', '+{countryCallingCode}');
        const CountryCode = Object.values(myCountryCodesObject);

        res.render("add_hospital", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, nameCode, CountryCode
        })
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/check_hospital_detail", auth, async(req, res)=>{
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
            const hospital_email = await DataFind(`SELECT * FROM tbl_hospital_list WHERE email = '${email}'`);
            if (hospital_email != '') check_email = false;
            else check_email = true;
        }

        if (country_code != '' && phone != '') {
            const hospital_number = await DataFind(`SELECT * FROM tbl_hospital_list WHERE country_code = '${country_code}' AND phone = '${phone}'`);
            if (hospital_number != '') check_mobileno = false;
            else check_mobileno = true;
        }

        res.send({check_email, check_mobileno, zonec})
    } catch (error) {
        console.log(error);
        res.send({check_email:1, check_mobileno:1, zonec:1})
    }
});

router.post("/add_hospital_data", auth, hospital.array('image'), async(req, res)=>{
    try {
        const {name, email, country_code, phone, latitude, longitude, address, status} = req.body;

        let imageUrl = '', esname = mysql.escape(name), esaddress = mysql.escape(address), statuss = status == "on" ? 1 : 0;
        for (const file of req.files) {
            imageUrl += imageUrl == '' ? `uploads/hospital/${file.filename}` : `&!!uploads/hospital/${file.filename}`
        }

        if (await DataInsert(`tbl_hospital_list`, `image, name, email, country_code, phone, latitude, longitude, address, status`, 
            `'${imageUrl}', ${esname}, '${email}', '${country_code}', '${phone}', '${latitude}', '${longitude}', ${esaddress}, '${statuss}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Hospital Add successfully');
        res.redirect("/hospital/list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/list", auth, async(req, res)=>{
    try {
        const hospital_list = await DataFind(`SELECT * FROM tbl_hospital_list ORDER BY id DESC`);

        hospital_list.map(val => {
            val.image = val.image.split("&!!")[0];
        });

        res.render("list_hospital", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, hospital_list
        })
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

        const hospital = await DataFind(`SELECT * FROM tbl_hospital_list WHERE id = '${req.params.id}'`);
        hospital[0].image = hospital[0].image.split("&!!");

        res.render("edit_hospital", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, nameCode, CountryCode, hospital:hospital[0]
        })
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/edit_hospital_data/:id", auth, hospital.array('image'), async(req, res)=>{
    try {
        const {name, email, country_code, phone, latitude, longitude, address, status} = req.body;

        const hospital = await DataFind(`SELECT * FROM tbl_hospital_list WHERE id = '${req.params.id}'`);

        let imageUrl = hospital[0].image, esname = mysql.escape(name), esaddress = mysql.escape(address), statuss = status == "on" ? 1 : 0;
        for (const file of req.files) {
            imageUrl += imageUrl == '' ? `uploads/hospital/${file.filename}` : `&!!uploads/hospital/${file.filename}`
        }

        if (await DataUpdate(`tbl_hospital_list`, `image = '${imageUrl}', name = ${esname}, email = '${email}', country_code = '${country_code}', phone = '${phone}', 
            latitude = '${latitude}', longitude = '${longitude}', address = ${esaddress}, status = '${statuss}'`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Hospital Updated successfully');
        res.redirect("/hospital/list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/delete_hospital_image", auth, async(req, res)=>{
    try {
        const {id, img} = req.body;
        
        const hospital = await DataFind(`SELECT id, image FROM tbl_hospital_list WHERE id = '${id}'`);
        
        let vid = "", dvid = "";
        if (hospital != "") {
            let videos = hospital[0].image.split("&!!");
            for (let i = 0; i < videos.length;) {
                if (videos[i] != img) vid += vid == "" ? videos[i] : `&!!${videos[i]}`;
                else dvid = videos[i];
                i++;
            }
            
            if (dvid != "") {
                await AllFunction.DeleteImage(dvid);
            }

            if (vid != "" || videos.length == 1) {
                if (await DataUpdate(`tbl_hospital_list`, `image = '${vid}'`, `id = '${hospital[0].id}'`, req.hostname, req.protocol) == -1) {
                    req.flash('errors', process.env.dataerror);
                    return res.redirect("/valid_license");
                }
            }
            return res.send({status: true});
        }
        return res.send({status: false});
    } catch (error) {
        console.log(error);
        return res.send({status: 1});
    }
});

router.get("/delete/:id", auth, async(req, res)=>{
    try {
        const hospital = await DataFind(`SELECT * FROM tbl_hospital_list WHERE id = '${req.params.id}'`);
        let videos = hospital[0].image.split("&!!");
        for (let i = 0; i < videos.length;) {
            await AllFunction.DeleteImage(videos[i]);
            i++;
        }

        if (await DataDelete(`tbl_hospital_list`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Hospital Deleted successfully');
        res.redirect("/hospital/list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
})





module.exports = router;
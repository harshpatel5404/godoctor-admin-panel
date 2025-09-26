/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */


const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const multer  = require('multer');
let mysql = require('mysql');
const fs = require('fs-extra');
const path = require("path");
const fontawesome_list = require("../public/fontawesome_list/list");
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/database_query");
const AllFunction = require("../route_function/function");
const bcrypt = require('bcrypt');
const countryCodes = require('country-codes-list');


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



function fulldate() {
    let date = new Date();
    let day = (date.getDate() < 10 ? '0'+date.getDate() : date.getDate());
    let month = (date.getMonth()+1 < 10 ? '0'+(date.getMonth()+1) : date.getMonth()+1);
    let year = date.getFullYear();
    return `${year}-${month}-${day}`;
}

// ============= Gallery ================ //

router.get("/gallery", auth, async(req, res)=>{
    try {
        const gallery_data = await DataFind(`SELECT * FROM tbl_doctor_gallery where doctor_id = '${req.user.admin_id}' ORDER BY id DESC`);
        
        res.render("doctor_gallery", {
            auth:req.user, gallery_data, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, general:req.general
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/add_gallery", auth, upload.single('file'), async(req, res)=>{
    try {
        let file = "uploads/gallery/" + req.file.filename;

        if (await DataInsert(`tbl_doctor_gallery`, `doctor_id, image`, `'${req.user.admin_id}', '${file}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        res.redirect("/user/gallery");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/delete_gallery", auth, async(req, res)=>{
    try {
        const {id} = req.body;

        const gallery_data = await DataFind(`SELECT * FROM tbl_doctor_gallery where id = '${id}' AND doctor_id = '${req.user.admin_id}'`);

        await AllFunction.DeleteImage(gallery_data[0].image);
        
        if (await DataDelete(`tbl_doctor_gallery`, `id = '${id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        res.send({status:true});
    } catch (error) {
        console.log(error);
        res.send({status:false});
    }
});



// ============= Sitter Pet ================ //

router.get("/doc_award", auth, async(req, res)=>{
    try {
        const doc_archi = await DataFind(`SELECT * FROM tbl_doctor_award_achievement where doctor_id = '${req.user.admin_id}' ORDER BY id DESC`);

        res.render("doctor_award_archi", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, doc_archi
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/add_doc_award", auth, async(req, res)=>{
    try {
        
        res.render("add_doc_award_archi",{
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname
        });
    } catch (error) {
        console.log(error);
        console.error("Internal Server Error!");
        return res.redirect("back");
    }
});

AllFunction.ImageUploadFolderCheck(`./public/uploads/doc_award`);
const storage1 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/doc_award");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const pet_image = multer({storage : storage1});

router.post("/add_doc_award", auth, pet_image.single('image'), async(req, res)=>{
    try {
        const {title, status} = req.body;

        const imageUrl = req.file ? "uploads/doc_award/" + req.file.filename : null, statuss = status == "on" ? 1 : 0, estitle = mysql.escape(title);

        if (await DataInsert(`tbl_doctor_award_achievement`, `doctor_id, image, title, status`,
            `'${req.user.admin_id}', '${imageUrl}', ${estitle}, '${statuss}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Awards and Achievement add successfully');
        res.redirect("/user/doc_award");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/edit_doc_award/:id", auth, async(req, res)=>{
    try {
        const docaward = await DataFind(`SELECT * FROM tbl_doctor_award_achievement where id = '${req.params.id}'`);
        
        res.render("edit_doc_award_archi", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, docaward:docaward[0]
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/doc_doc_award_data/:id", auth, pet_image.single('image'), async(req, res)=>{
    try {
        const {title, status} = req.body;

        const docaward = await DataFind(`SELECT * FROM tbl_doctor_award_achievement where id = '${req.params.id}'`);
        if (docaward != '') {
            let imageUrl = ''
            if (req.file) {
                await AllFunction.DeleteImage(docaward[0].image);
                imageUrl = "uploads/doc_award/" + req.file.filename
            } else imageUrl = docaward[0].image
    
            const statuss = status == "on" ? 1 : 0, estitle = mysql.escape(title);
    
            if (await DataUpdate(`tbl_doctor_award_achievement`, `image = '${imageUrl}', title = ${estitle}, status = '${statuss}'`,
                `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
            
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
    
            req.flash('success', 'Awards and Achievement Updated successfully');
        }
        res.redirect("/user/doc_award");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/delete_doc_award/:id", auth, async(req, res)=>{
    try {
        const docaward = await DataFind(`SELECT * FROM tbl_doctor_award_achievement where id = '${req.params.id}'`);
        if (docaward != '') {
            await AllFunction.DeleteImage(docaward[0].image);
            if (await DataDelete(`tbl_doctor_award_achievement`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {

                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
            
            req.flash('success', 'Awards and Achievement Deleted successfully');
        }
        res.redirect("/user/doc_award");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});



// ============= Services ================ //

router.get("/services", auth, async(req, res)=>{
    try {
        const hospital_id_list = await DataFind(`SELECT JSON_ARRAYAGG(hospital_id) AS hospital_ids 
                                                FROM (SELECT DISTINCT hospital_id FROM tbl_doctor_hos_depart_list WHERE doctor_id = '${req.user.admin_id}') AS unique_hospitals;`);        
        
        let serd = [];
        serd = await DataFind(`SELECT hos_dep.id, hos_dep.hospital_id, hos_dep.department_id, hos_dep.sub_title, hos_dep.image, hos_dep.client_visit_price, 
                                        hos_dep.video_consult_price, hos_dep.show_type, hos_dep.status, COALESCE(hos.name) AS hospital_name, COALESCE(dep.name) AS depart_name
                                        FROM tbl_doctor_hos_depart_list AS hos_dep 
                                        LEFT JOIN tbl_hospital_list AS hos on hos.id =  hos_dep.hospital_id
                                        LEFT JOIN tbl_department_list AS dep on dep.id =  hos_dep.department_id
                                        where doctor_id = '${req.user.admin_id}' AND hospital_id IN (${hospital_id_list[0].hospital_ids.join(",")}) `);

        let serices_id = "";
        for (let a = 0; a < serd.length;) {
            if (a == 0) {
                serices_id += serd[a].id;
            } else {
                serices_id += "&!" + serd[a].id;
            }a++;
        }

        res.render("doctor_services", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, hospital_id_list:hospital_id_list[0].hospital_ids, serd, serices_id
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

AllFunction.ImageUploadFolderCheck(`./public/uploads/dep_subservice`);
const storage2 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/dep_subservice");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const hdimage = multer({storage : storage2});

router.post("/update_service_image", auth, hdimage.single("image"), async(req, res)=>{
    try {
        const { id, edsimg } = req.body;
        
        const dhd = await DataFind(`SELECT * FROM tbl_doctor_hos_depart_list WHERE id = '${id}'`);
        let ImageUrl = ''
        if (dhd != '') {
            
            if (edsimg != '') await AllFunction.DeleteImage(edsimg);
            else if (dhd[0].image != '') await AllFunction.DeleteImage(dhd[0].image);
            if (req.file) {
                ImageUrl = `uploads/dep_subservice/${req.file.filename}`;
                if (await DataUpdate(`tbl_doctor_hos_depart_list`, `image = '${ImageUrl}'`,
                    `id = '${dhd[0].id}'`, req.hostname, req.protocol) == -1) {
                    
                    req.flash('errors', process.env.dataerror);
                    return res.redirect("/valid_license");
                }
            }

        }
        
        return res.send({ ImageUrl });
    } catch (error) {
        console.log(error);
        return res.send({ ImageUrl: '' });
    }
});

router.post("/edit_services/:id", auth, hdimage.array("image"), async(req, res)=>{
    try {
        const {hd_id, subservice, client_vis_price, video_con_price, show_type, status} = req.body;

        let ste_hd_id = [], ste_subs = [], str_cvprice = [], str_vcprice = [], str_stype, str_status = [];
        if (typeof hd_id == "string") {
            ste_hd_id = [hd_id];
            ste_subs = [subservice];
            str_cvprice = [client_vis_price];
            str_vcprice = [video_con_price];
            str_stype = [show_type];
            str_status = [status];
        } else {
            ste_hd_id = [...hd_id];
            ste_subs = [...subservice];
            str_cvprice = [...client_vis_price];
            str_vcprice = [...video_con_price];
            str_stype = [...show_type];
            str_status = [...status];
        }
        
        for (let i = 0; i < ste_hd_id.length;){

            const statuss = str_status[i];

            if (await DataUpdate(`tbl_doctor_hos_depart_list`, `sub_title = '${ste_subs[i]}', client_visit_price = '${str_cvprice[i]}', 
                video_consult_price = '${str_vcprice[i]}', show_type = '${str_stype[i]}', status = '${statuss}'`,
                `id = '${ste_hd_id[i]}'`, req.hostname, req.protocol) == -1) {
                
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
            i++;
        }

        req.flash('success', 'Services Updated successfully');
        res.redirect("/user/services");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});



// ============= Sitter About ================ //

router.get("/about", auth, async(req, res)=>{
    try {
        const about_data = await DataFind(`SELECT * FROM tbl_about WHERE doctor_id = '${req.user.admin_id}'`);

        if (about_data != "") {
            const aboutid = about_data[0].about_id.split("&!");
            const aboutheading = about_data[0].heading.split("&!");
            const aboutdes = about_data[0].description.split("&!");
            const abouttitle = about_data[0].title.split("&!");
            const abouticon = about_data[0].icon.split("&&!");
            const aboutsubtitle = about_data[0].sub_title.split("&&!");

            let head_des = [];
            aboutheading.forEach((heading, index) => {

                let dataicon = abouticon[index].split("&!");
                let datasub = aboutsubtitle[index].split("&!");

                const about = [];
                for (let i = 0; i < dataicon.length;){
                    about.push({ id: aboutid[index], icon: dataicon[i], subtitle: datasub[i] });
                    i++;
                }   

                head_des.push({ head: heading, description: aboutdes[index], title: abouttitle[index], about: about });
            });

            res.render("doctor_about", {
                auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, head_des
            });
        } else {
            
            res.render("doctor_about", {
                auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, head_des : ""
            });
        }
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});



AllFunction.ImageUploadFolderCheck(`./public/uploads/about`);

router.get("/add_about", auth, async(req, res)=>{
    try {
        const about_data = await DataFind(`SELECT * FROM tbl_about WHERE doctor_id = '${req.user.admin_id}'`);

        const folderPath = path.resolve(__dirname, '../public/uploads/about');
        let imagel = [];
        fs.readdirSync(folderPath).forEach(file => {
            imagel.push({imgpath : "../../uploads/about/" + file, imgname : file});
        });
            
        if (about_data != "") {
            const aboutid = about_data[0].about_id.split("&!");
            const aboutheading = about_data[0].heading.split("&!");
            const aboutdes = about_data[0].description.split("&!");
            const abouttitle = about_data[0].title.split("&!");
            const abouticon = about_data[0].icon.split("&&!");
            const aboutsubtitle = about_data[0].sub_title.split("&&!");

            let head_des = [];
            aboutheading.forEach((heading, index) => {
                let dataicon = abouticon[index].split("&!");
                let datasub = aboutsubtitle[index].split("&!");

                const about = [];
                for (let i = 0; i < dataicon.length;){
                    about.push({ id: aboutid[index], icon: dataicon[i], subtitle: datasub[i] });
                    i++;
                }

                head_des.push({ head: heading, description: aboutdes[index], title: abouttitle[index], about: about });
            });
            
            res.render("add_doctor_about", {
                auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, fontawesome_list, head_des, imagel
            });
        } else {
            res.render("add_doctor_about", {
                auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, fontawesome_list, head_des : "", imagel
            });
        }
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/add_about_data", auth, async(req, res)=>{
    try {
        const {about_heading, about_description, title, about_id, icon, about_subtitle} = req.body;

        let about_head, about_des;
        if (typeof about_heading == "string") {
            about_head = [about_heading];
            about_des = [about_description];
        } else {
            about_head = [...about_heading];
            about_des = [...about_description];
        }

        let about_title, aboutid, about_icon, about_subtit;
        if (typeof title == "string") {
            about_title = [title];
            aboutid = [about_id];
            about_icon = [icon];
            about_subtit = [about_subtitle];
        } else {
            about_title = [...title];
            aboutid = [...about_id];
            about_icon = [...icon];
            about_subtit = [...about_subtitle];
        }

        let abouttitle = "" ,abouid = "" ,abouticon = "" ,aboutsubtitle = "";
        
        let abouthead = "", aboutdes = "";
        for (let a = 0; a < about_head.length;){
            if (a == 0) {
                abouthead += about_head[a];
                aboutdes += about_des[a];
            } else {
                abouthead += '&!' + about_head[a];
                aboutdes += '&!' + about_des[a];
            }
            
            let titl = "" ,uid = "" ,aicon = "" ,subtit = "";
            for (let i = 0; i < about_title.length;){

                let iconp = "";
                if (about_icon[i].includes("uploads/about/") === true) iconp = about_icon[i]    ;
                else iconp = "uploads/about/" + about_icon[i];

                if (a+1 == aboutid[i]) {
                    if (titl == "") {
                        titl += about_title[i];
                        uid += aboutid[i];
                        aicon += iconp;
                        subtit += about_subtit[i];
                    } else {
                        aicon += '&!' + iconp;
                        subtit += '&!' + about_subtit[i];
                    }
                }
                i++;
            }

            abouttitle += abouttitle == "" ? titl : '&!' + titl;
            abouticon += abouticon == "" ? aicon : '&&!' + aicon;
            aboutsubtitle += aboutsubtitle == "" ? subtit : '&&!' + subtit;
            abouid += abouid == "" ? uid : '&!' + uid;
            a++;
        }

        let estitle = mysql.escape(abouttitle), essubtitle = mysql.escape(aboutsubtitle), esheading = mysql.escape(abouthead), esdes = mysql.escape(aboutdes);

        const about_data = await DataFind(`SELECT * FROM tbl_about WHERE doctor_id = '${req.user.admin_id}'`);

        if (about_data == "") {

            if ( await DataInsert(`tbl_about`, `doctor_id, about_id, title, icon, sub_title, heading, description`,
                `'${req.user.admin_id}', '${abouid}', ${estitle}, '${abouticon}', ${essubtitle}, ${esheading}, ${esdes}`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
        } else {

            if (await DataUpdate(`tbl_about`, `about_id = '${abouid}', title = ${estitle}, icon = '${abouticon}', sub_title = ${essubtitle}, heading = ${esheading}, description = ${esdes}`,
                `doctor_id = '${req.user.admin_id}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
        }

        req.flash('success', 'About Updated successfully');
        res.redirect("/user/about");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});



// ============= Sitter FAQ ================ //

router.get("/faq", auth, async(req, res)=>{
    try {
        const sitter_faq_data = await DataFind(`SELECT * FROM tbl_doctor_faq WHERE doctor_id = '${req.user.admin_id}' ORDER BY id DESC`);
        
        res.render("doctor_faq", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, sitter_faq_data
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/add_faq", auth, async(req, res)=>{
    try {
        const {title, description} = req.body;

        const faq_faq_title = mysql.escape(title);
        const faq_faq_des = mysql.escape(description);

        if (await DataInsert(`tbl_doctor_faq`, `doctor_id, title, description`, `'${req.user.admin_id}', ${faq_faq_title}, ${faq_faq_des}`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        res.redirect("/user/faq");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/edit_faq/:id", auth, async(req, res)=>{
    try {
        const {title, description} = req.body;
            
        const faq_faq_title = mysql.escape(title);
        const faq_faq_des = mysql.escape(description);
    
        if (await DataUpdate(`tbl_doctor_faq`, `title = ${faq_faq_title}, description = ${faq_faq_des}`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        res.redirect("/user/faq");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/delete_faq/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_doctor_faq`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        res.redirect("/user/faq");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});



// ============= Sitter Review ================ //

router.get("/reviews", auth, async(req, res)=>{
    try {
        const rd = await DataFind(`SELECT 
                                            COALESCE(cus.name, '') as cus_name, COALESCE(hos.name, '') as hos_name, COALESCE(dl.name, '') as dep_name, dr.date, dr.review, dr.star_no
                                            FROM tbl_doctor_reviews AS dr
                                            LEFT JOIN tbl_booked_appointment AS ba ON dr.appointment_id = ba.id
                                            LEFT JOIN tbl_department_list AS dl ON dl.id = ba.department_id
                                            LEFT JOIN tbl_customer AS cus ON cus.id = dr.customer_id
                                            LEFT JOIN tbl_hospital_list AS hos ON hos.id = dr.hospital_id
                                            WHERE dr.doctor_id = '${req.user.admin_id}'`);

        const review_data = rd.map(val => ({
            ...val,
            date: new Date(val.date).toLocaleString('en-US', {
                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone 
            })
        }));
        
        res.render("doctor_reviews", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, review_data
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});



// ============= Sitter Coupon ================ //

router.get("/coupon", auth, async(req, res)=>{
    try {
        const coupon_list = await DataFind(`SELECT * FROM tbl_coupon WHERE doctor_id = '${req.user.admin_id}' ORDER BY id DESC`);
        // console.log(coupon_list);
        
        res.render("doctor_coupon", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, coupon_list
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/add_coupon", auth, async(req, res)=>{
    try {
        const {title, sub_title, code, start_date, end_date, min_amount, discount_amount} = req.body;
        
        if (await DataInsert(`tbl_coupon`, `doctor_id, title, sub_title, code, start_date, end_date, min_amount, discount_amount`,
            `'${req.user.admin_id}', '${title}', '${sub_title}', '${code}', '${start_date}', '${end_date}', '${min_amount}', '${discount_amount}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Coupon Add successfully');
        res.redirect("/user/coupon");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/edit_coupon/:id", auth, async(req, res)=>{
    try {
        const {title, sub_title, code, start_date, end_date, min_amount, discount_amount} = req.body;

        if (await DataUpdate(`tbl_coupon`,
            `title = '${title}', sub_title = '${sub_title}', code = '${code}', start_date = '${start_date}', end_date = '${end_date}', min_amount = '${min_amount}', 
            discount_amount = '${discount_amount}'`,
            `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Coupon Updated successfully');
        res.redirect("/user/coupon");
    } catch (error) {
        console.log(error)
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/delete_coupon/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_coupon`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Coupon Deleted successfully');
        res.redirect("/user/coupon");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

// ============= Sitter Setting ================ //

router.get("/setting", auth, async(req, res)=>{
    try {
        let setting = await DataFind(`SELECT * FROM tbl_doctor_setting where doctor_id = '${req.user.admin_id}'`);

        if (setting == "") {
            await DataInsert(`tbl_doctor_setting`, `doctor_id, extra_patient_charge, defaultm`, `'${req.user.admin_id}', '0', ''`);
            setting = await DataFind(`SELECT * FROM tbl_doctor_setting where doctor_id = '${req.user.admin_id}'`);
        }

        const doctor = await DataFind(`SELECT id, per_patient_time FROM tbl_doctor_list where id = '${req.user.admin_id}'`);

        res.render("doctor_setting", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, setting, doctor: doctor[0]
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
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

router.post("/user_setting", auth, doc_sign.single("image"), async(req, res)=>{
    try {
        const {extra_patient_charge, defaultm, time_gap} = req.body;

        const setting = await DataFind(`SELECT * FROM tbl_doctor_setting where doctor_id = '${req.user.admin_id}'`);

        if (time_gap < 10) {
            req.flash('errors', `Enter valid patient time`);
            return res.redirect("back");
        }

        let imageUrl = '';
        if (req.file) {
            if (setting[0].sign_image != '') await AllFunction.DeleteImage(setting[0].sign_image);
            imageUrl = `uploads/doctor_sign/${req.file.filename}`;
        } else imageUrl = setting[0].sign_image;

        if (setting == "") {
            
            if (await DataInsert(`tbl_doctor_setting`, `doctor_id, sign_image, extra_patient_charge, defaultm`, `'${req.user.admin_id}', '${imageUrl}', '${extra_patient_charge}', 
                '${defaultm}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
        } else {
            
            if (await DataUpdate(`tbl_doctor_setting`, `sign_image = '${imageUrl}',extra_patient_charge = '${extra_patient_charge}', defaultm = '${defaultm}'`, 
                `doctor_id = '${req.user.admin_id}'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
        }

        const doctor = await DataFind(`SELECT id, per_patient_time FROM tbl_doctor_list where id = '${req.user.admin_id}'`);

        let per_pat_time = 0;
        if (time_gap <= 0 || isNaN(time_gap)) per_pat_time = Number(doctor[0].per_patient_time)
        else per_pat_time = Number(time_gap);

        if (await DataUpdate(`tbl_doctor_list`, `per_patient_time = '${per_pat_time}'`, `id = '${req.user.admin_id}'`, req.hostname, req.protocol) == -1) {
            
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Setting Updated successfully');
        res.redirect("/user/setting");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});



// ============= Sitter Time Management ================ //

router.get("/time", auth, async(req, res)=>{
    try {

       

        const doctor = await DataFind(`SELECT id, per_patient_time FROM tbl_doctor_list WHERE id = '${req.user.admin_id}'`);
        
        if (!doctor) {
            req.flash('errors', `Doctor not found`);
            return res.redirect('back');
        }

        const dhd_list = await DataFind(`SELECT hos.id AS hospital_id, COALESCE(hos.name, '') AS hospital_name, 
                                        dht.date_time_list
                                        FROM tbl_doctor_hos_time AS dht
                                        LEFT JOIN tbl_hospital_list AS hos ON hos.id = dht.hospital_id
                                        WHERE dht.doctor_id = '${req.user.admin_id}'`);
        
        if (!Array.isArray(dhd_list) || dhd_list.length === 0) {
            req.flash('errors', `Doctor hospital timing not found`);
            return res.redirect('back');
        }
        
        dhd_list.forEach(item => {
            if (typeof item.date_time_list === 'string') {
                try {
                    item.date_time_list = JSON.parse(item.date_time_list);
                } catch (e) {
                    item.date_time_list = [];
                }
            }
        });

        const selectedHospitalId = dhd_list[0]?.hospital_id;

        const time_data = await DataFind(`SELECT * FROM tbl_doctor_hos_time WHERE doctor_id = '${req.user.admin_id}' AND hospital_id = '${selectedHospitalId}'`);
        
        const perPatientTime = Number(doctor.per_patient_time);
        const slotDuration = (perPatientTime && perPatientTime > 0) ? perPatientTime : 20;
        
        const { morning, afternoon, evening } = await AllFunction.generateAndSplitTimeSlots(slotDuration);
        
        const day_list = AllFunction.AllDayList;
        
        const ndatelist = await AllFunction.TimeDurationWebSlot( dhd_list, selectedHospitalId, time_data, morning, afternoon, evening, '');

        res.render("doctor_time_management", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, day_list, dhd_list, time_data: time_data[0], doctor, ndatelist
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/add_time_data", auth, async(req, res)=>{
    try {
        const {hospital, old_hosid, 
            tot_morning, tot_afternoon, tot_evening, tot_time,
            Sunday_Morning, Sunday_Afternoon, Sunday_Evening, 
            Monday_Morning, Monday_Afternoon, Monday_Evening,
            Tuesday_Morning, Tuesday_Afternoon, Tuesday_Evening, 
            Wednesday_Morning, Wednesday_Afternoon, Wednesday_Evening,
            Thursday_Morning, Thursday_Afternoon, Thursday_Evening, 
            Friday_Morning, Friday_Afternoon, Friday_Evening,
            Saturday_Morning, Saturday_Afternoon, Saturday_Evening,
        } = req.body;
        
        if (hospital == old_hosid) {
            
            let day_list = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            // let dalist = ["Sunday_Morning", "Sunday_Afternoon", "Sunday_Evening",  "Monday_Morning", "Monday_Afternoon", "Monday_Evening", "Tuesday_Morning", "Tuesday_Afternoon", "Tuesday_Evening",  "Wednesday_Morning", "Wednesday_Afternoon", "Wednesday_Evening", "Thursday_Morning", "Thursday_Afternoon", "Thursday_Evening",  "Friday_Morning", "Friday_Afternoon", "Friday_Evening", "Saturday_Morning", "Saturday_Afternoon", "Saturday_Evening"];
            let date_list = [];
    
            day_list.forEach(dval => {
                
                let mval = [], aval = [], tval = [];
    
                if (req.body[`${dval}_Morning`]) mval = req.body[`${dval}_Morning`].filter(item => item.trim() !== '');
                if (req.body[`${dval}_Afternoon`]) aval = req.body[`${dval}_Afternoon`].filter(item => item.trim() !== '');
                if (req.body[`${dval}_Evening`]) tval = req.body[`${dval}_Evening`].filter(item => item.trim() !== '');
    
                date_list.push({
                    [dval]: {
                        "Morning" : mval,
                        "Afternoon" : aval,
                        "Evening" : tval
                    }
                });
                
            });
    
            if (await DataUpdate(`tbl_doctor_hos_time`, `date_time_list = '${JSON.stringify(date_list)}'`, 
                `doctor_id = '${req.user.admin_id}' AND hospital_id = '${hospital}'`, req.hostname, req.protocol) == -1) {
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }

        }

        req.flash('success', 'Time Updated successfully');
        res.redirect("/user/time");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/doc_time_change", auth, async(req, res)=>{
    try {
        const {hospital} = req.body;

        const doctor = await DataFind(`SELECT id, per_patient_time FROM tbl_doctor_list where id = '${req.user.admin_id}'`);
        
        const dhd_list = await DataFind(`SELECT hos.id AS hospital_id, COALESCE(hos.name, '') AS hospital_name, 
                                        dht.date_time_list
                                        FROM tbl_doctor_hos_time AS dht
                                        LEFT JOIN tbl_hospital_list AS hos ON hos.id = dht.hospital_id
                                        WHERE dht.doctor_id = '${req.user.admin_id}' `);

        if (dhd_list == '' || doctor == '') return res.send({ day_list:[], ndatelist:[] });
        dhd_list[0].date_time_list = typeof dhd_list[0].date_time_list == "string" ? JSON.parse(dhd_list[0].date_time_list) : dhd_list[0].date_time_list;
        
        const time_data = await DataFind(`SELECT * FROM tbl_doctor_hos_time where doctor_id = '${req.user.admin_id}' AND hospital_id = '${hospital}'`);
        time_data[0].date_time_list = typeof time_data[0].date_time_list == "string" ? JSON.parse(time_data[0].date_time_list) : time_data[0].date_time_list;
        time_data[0].book_time_list = typeof time_data[0].book_time_list == "string" ? JSON.parse(time_data[0].book_time_list) : time_data[0].book_time_list;
        
        let prtptime = doctor[0].per_patient_time != 0 && doctor[0].per_patient_time != 'null' && doctor[0].per_patient_time < 0 ? doctor[0].per_patient_time : 20;
        
        let { morning, afternoon, evening } = await AllFunction.generateAndSplitTimeSlots(prtptime);
        
        const ndatelist = await AllFunction.TimeDurationWebSlot(dhd_list, hospital, time_data, morning, afternoon, evening, '');
        
        res.send({ day_list: AllFunction.AllDayList, ndatelist });
    } catch (error) {
        console.log(error);
        return res.send({ day_list:[], ndatelist:[] });
    }
});

// ============= Sitter Wallet ================ //

router.get("/wallet", auth, async(req, res)=>{
    try {
        const doctor = await DataFind(`SELECT dl.wallet, dl.tot_payout, dl.cash_amount, dl.success_payout, COALESCE(gs.d_min_withdraw, 0) AS d_min_withdraw
                                        FROM tbl_doctor_list AS dl
                                        LEFT JOIN tbl_general_settings AS gs ON 1 = 1
                                        WHERE dl.id = '${req.user.admin_id}'`);
        if(doctor == '') {
            req.flash('errors', `Data not found!`);
            return res.redirect("back");
        }
        
        const app = await DataFind(`SELECT bookap.id, (bookap.tot_price - bookap.site_commisiion) AS tot_earning, bookap.tot_price, bookap.site_commisiion, bookap.wallet_amount, 
                                    0 AS online_amount, 0 AS cash_amount,
                                    bookap.appointment_date, 
                                    bookap.appointment_time, CASE WHEN bookap.status IN (3,4) THEN 'completed' WHEN bookap.status IN (5) THEN 'canceled' END AS status_type,
                                    COALESCE(cus.name, '') AS cus_name, COALESCE(pd.name, '') AS p_name, bookap.wallet_amount AS wallet_status
                                    -- FROM tbl_doctor_payout_adjust AS dpa
                                    FROM tbl_booked_appointment AS bookap
                                    LEFT JOIN tbl_customer AS cus ON cus.id = bookap.customer_id
                                    LEFT JOIN tbl_payment_detail AS pd ON pd.id = bookap.payment_id
                                    WHERE bookap.doctor_id = '${req.user.admin_id}' AND bookap.status IN (3,4,5) ORDER BY bookap.id DESC;`);
        
        const all_data = [];
        app.forEach(item => {
            item.date = new Date(`${item.appointment_date} ${item.appointment_time}`).toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });

            if (item.p_name != 'Cash') item.online_amount = Number((item.tot_price - item.wallet_amount).toFixed(2));
            else item.online_amount = 0;

            if (item.p_name == 'Cash') item.cash_amount = Number((item.tot_price - item.wallet_amount).toFixed(2));
            
            item.wallet_status = item.wallet_status > 0 ? 1 : 0;

            delete item.appointment_date; delete item.appointment_time;

            all_data.push(item);
        });

        res.render('doctor_wallet', {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, doctor, all_data
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});



router.post("/doc_withd_data", auth, async(req, res)=>{
    try {
        const doctor = await DataFind(`SELECT dl.tot_payout, COALESCE(gs.d_min_withdraw, 0) AS d_min_withdraw
                                        FROM tbl_doctor_list AS dl
                                        LEFT JOIN tbl_general_settings AS gs ON 1 = 1
                                        WHERE dl.id = '${req.user.admin_id}'`);
        
        res.send({ status: doctor != '' ? true : false, doctor });
    } catch (error) {
        console.log(error);
        res.send({ status: false, doctor: [] });
    }
});

router.post("/wallet_withdraw", auth, async(req, res)=>{
    try {
        const { Withdraw_amount, spayment_type, upi_id, paypal_id, bank_no, bank_ifsc, bank_type } = req.body;

        const doctor = await DataFind(`SELECT dl.id, dl.tot_payout, dl.success_payout, COALESCE(gs.d_min_withdraw, 0) AS d_min_withdraw
                                        FROM tbl_doctor_list AS dl
                                        LEFT JOIN tbl_general_settings AS gs ON 1 = 1
                                        WHERE dl.id = '${req.user.admin_id}'`);

        if (parseFloat(doctor[0].tot_payout) >= parseFloat(doctor[0].d_min_withdraw)) {
            const date = new Date().toISOString();

            if (parseFloat(Withdraw_amount) >= parseFloat(doctor[0].d_min_withdraw) && parseFloat(Withdraw_amount) <= parseFloat(doctor[0].tot_payout)) {

                let check = 0, wid;
                if (spayment_type == "1") {
                    check = 1;
                    if (await DataInsert(`tbl_doctor_payout_adjust`,
                        `appointment_id, doctor_id, amount, date, status, p_status, image, p_type, upi_id, paypal_id, bank_no, bank_ifsc, bank_type`,
                        `'', '${req.user.admin_id}', '${Withdraw_amount}', '${date}', '2', '0', '', '1', '${upi_id}', '', '', '', ''`, req.hostname, req.protocol) == -1) {
        
                        req.flash('errors', process.env.dataerror);
                        return res.redirect("/valid_license");
                    }
        
                } else if (spayment_type == "2") {
                    check = 1;
                    if (await DataInsert(`tbl_doctor_payout_adjust`,
                        `appointment_id, doctor_id, amount, date, status, p_status, image, p_type, upi_id, paypal_id, bank_no, bank_ifsc, bank_type`,
                        `'', '${req.user.admin_id}', '${Withdraw_amount}', '${date}', '2', '0', '', '2', '', '${paypal_id}', '', '', ''`, req.hostname, req.protocol) == -1) {
        
                        req.flash('errors', process.env.dataerror);
                        return res.redirect("/valid_license");
                    }
                                    
                } else if (spayment_type == "3") {
                    check = 1;
                    if (await DataInsert(`tbl_doctor_payout_adjust`,
                        `appointment_id, doctor_id, amount, date, status, p_status, image, p_type, upi_id, paypal_id, bank_no, bank_ifsc, bank_type`,
                        `'', '${req.user.admin_id}', '${Withdraw_amount}', '${date}', '2', '0', '', '3', '', '', '${bank_no}', '${bank_ifsc}', '${bank_type}'`, req.hostname, req.protocol) == -1) {
        
                        req.flash('errors', process.env.dataerror);
                        return res.redirect("/valid_license");
                    }
        
                }

                if (check == "1") {
                    let total = parseFloat((Number(doctor[0].tot_payout) - Number(Withdraw_amount)).toFixed(2));
                    let success_payout = parseFloat((Number(doctor[0].success_payout) + Number(Withdraw_amount)).toFixed(2));
                    
                    if (await DataUpdate(`tbl_doctor_list`, `tot_payout = '${total}', success_payout = '${success_payout}'`, `id = '${doctor[0].id}'`, req.hostname, req.protocol) == -1) {
                        return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
                    }
                }

                req.flash('success', 'Wallet Withdraw Request add successfully');
                res.redirect("/user/wallet");
                return;
            }   

            if (parseFloat(Withdraw_amount) < parseFloat(doctor[0].d_min_withdraw)) req.flash('errors', `Minimum Withdrawal Amount ${parseFloat(doctor[0].d_min_withdraw)}`);
            if (parseFloat(Withdraw_amount) > parseFloat(doctor[0].tot_payout)) req.flash('errors', `Maximum Withdrawal Amount ${parseFloat(doctor[0].tot_payout)}`);
            res.redirect("/user/wallet");
            return;
        }
        req.flash('errors', `Minimum Withdrawal Amount ${parseFloat(doctor[0].d_min_withdraw)}`);
        res.redirect("/user/wallet");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});





// ============= Sitter Wallet ================ //

router.get("/cash_management", auth, async(req, res)=>{
    try {
        const doctor = await DataFind(`SELECT cash_amount, success_cash FROM tbl_doctor_list WHERE id = '${req.user.admin_id}'`);
        if (doctor == '') {
            req.flash('errors', `User not found!`);
            return res.redirect("back");
        }

        const cash_list = await DataFind(`SELECT * FROM tbl_doctor_cash_adjust WHERE doctor_id = '${req.user.admin_id}' AND status = '2' ORDER BY id DESC`);
                     
        cash_list.map(a => {
            a.date = new Date(a.date).toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
        });

        res.render('doctor_cash_adjust', {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, cash: doctor[0], cash_list
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/doc_cash_wbalance", auth, async(req, res)=>{
    try {
        const doctor = await DataFind(`SELECT cash_amount, success_cash FROM tbl_doctor_list WHERE id = '${req.user.admin_id}'`);
        
        res.send({ status: doctor != '' ? true : false, doctor });
    } catch (error) {
        console.log(error);
        res.send({ status: false, doctor: [] });
    }
});



const storage5 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/cash_proof");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const cash_proof = multer({storage : storage5});

router.post("/withdraw_cash_amount", auth, cash_proof.single("cash_proof_img"), async(req, res)=>{
    try {
        const {cash_amount, payment_type} = req.body;
        
        if (!req.file) req.flash('errors', 'Please upload proof!');

        const doctor = await DataFind(`SELECT id, cash_amount, success_cash FROM tbl_doctor_list WHERE id = '${req.user.admin_id}'`);
        if(doctor == '') {
            if (req.file) await AllFunction.DeleteImage("uploads/cash_proof/" + req.file.filename);
            req.flash('errors', 'User not found!');
        }

        if (doctor[0].cash_amount >= Number(cash_amount)) {
            
            const imageUrl = req.file ? "uploads/cash_proof/" + req.file.filename : null;

            if (await DataInsert(`tbl_doctor_cash_adjust`, `appointment_id, doctor_id, status, proof_image, amount, date, payment_type, c_status`, 
                `'', '${req.user.admin_id}', '2', '${imageUrl}', '${cash_amount}', '${new Date().toISOString()}', '${payment_type}', '1'`, req.hostname, req.protocol) == -1) {
        
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }

            let cash_total = parseFloat((Number(doctor[0].cash_amount) - Number(cash_amount)).toFixed(2));
            let success_cash = parseFloat((Number(doctor[0].success_cash) + Number(cash_amount)).toFixed(2));

            if (await DataUpdate(`tbl_doctor_list`, `cash_amount = '${cash_total}', success_cash = '${success_cash}'`, `id = '${doctor[0].id}'`, req.hostname, req.protocol) == -1) {
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }

            req.flash('success', 'Cash withdraw successful');

        } else req.flash('errors', `Your available cash balance ${doctor[0].cash_amount}`);

        res.redirect("/user/cash_management");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/cash_history", auth, async(req, res)=>{
    try {
        const doctor = await DataFind(`SELECT cash_amount, success_cash FROM tbl_doctor_list WHERE id = '${req.user.admin_id}'`);
        if (doctor == '') {
            req.flash('errors', `User not found!`);
            return res.redirect("back");
        }

        const app = await DataFind(`SELECT bookap.id, (bookap.tot_price - bookap.site_commisiion) AS tot_earning, bookap.tot_price, bookap.site_commisiion, bookap.wallet_amount, 
                                    0 AS online_amount, 0 AS cash_amount, dca.amount AS add_cash, bookap.appointment_date, bookap.appointment_time,
                                    COALESCE(pd.name, '') AS p_name, bookap.wallet_amount AS wallet_status
                                    FROM tbl_doctor_cash_adjust AS dca
                                    JOIN tbl_booked_appointment AS bookap ON bookap.id = dca.appointment_id
                                    LEFT JOIN tbl_payment_detail AS pd ON pd.id = bookap.payment_id
                                    WHERE dca.appointment_id != '' AND dca.doctor_id = '${req.user.admin_id}' ORDER BY dca.id DESC;`);
        
        let all_data = [], tot_with_amount = 0;
        app.forEach(item => {
            item.date = new Date(`${item.appointment_date} ${item.appointment_time}`).toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });

            if (item.p_name != 'Cash') item.online_amount = Number((item.tot_price - item.wallet_amount).toFixed(2));
            else item.online_amount = 0;

            if (item.p_name == 'Cash') item.cash_amount = Number((item.tot_price - item.wallet_amount).toFixed(2));
            
            item.wallet_status = item.wallet_status > 0 ? 1 : 0;

            tot_with_amount += item.cash_amount

            delete item.appointment_date; delete item.appointment_time;

            all_data.push(item);
        });
        
        res.render('doctor_cash_history', {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, doctor, all_data, tot_with_amount
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/payout_history", auth, async(req, res)=>{
    try {
        const doctor = await DataFind(`SELECT tot_payout, success_payout FROM tbl_doctor_list WHERE id = '${req.user.admin_id}'`);
        if(doctor == '') {
            req.flash('errors', `User not found!`);
            return res.redirect("back");
        }

        const app = await DataFind(`SELECT id, appointment_id, doctor_id, amount, date, status, p_status, image, p_type
                                    FROM tbl_doctor_payout_adjust WHERE doctor_id = '${req.user.admin_id}' ORDER BY id DESC`);
                                    
        app.map(val => {
            val.date = new Date(val.date).toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })
        });
        
        res.render('doctor_payout_history', {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, doctor, payout_list: app
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});



router.get("/medicine_wallet", auth, async(req, res)=>{
    try {
        const doctor = await DataFind(`SELECT dl.wallet, dl.medicine_payout, dl.success_medicine_payout, COALESCE(gs.d_min_withdraw, 0) AS d_min_withdraw
                                        FROM tbl_doctor_list AS dl
                                        LEFT JOIN tbl_general_settings AS gs ON 1 = 1
                                        WHERE dl.id = '${req.user.admin_id}'`);
        if(doctor == '') {
            req.flash('errors', `Data not found!`);
            return res.redirect("back");
        }
        
        const app = await DataFind(`SELECT bookap.id, (bookap.tot_price - bookap.site_commission) AS tot_earning, bookap.tot_price, bookap.site_commission, bookap.date, 
                                    CASE WHEN bookap.status = '3' THEN 'completed' WHEN bookap.status = '4' THEN 'canceled' END AS status_type,
                                    COALESCE(cus.name, '') AS cus_name, COALESCE(pd.name, '') AS p_name
                                    -- FROM tbl_doctor_product_payout_adjust AS dp
                                    FROM tbl_order_product AS bookap
                                    LEFT JOIN tbl_customer AS cus ON cus.id = bookap.customer_id
                                    LEFT JOIN tbl_payment_detail AS pd ON pd.id = bookap.payment_id
                                    WHERE bookap.doctor_id = '${req.user.admin_id}' AND bookap.status IN (3,4) ORDER BY bookap.id DESC;`);
        
        app.forEach(item => {
            item.date = new Date(item.date).toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
        });

        res.render('doctor_medicine_wallet', {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, doctor, all_data: app
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/doc_dwpay_data", auth, async(req, res)=>{
    try {
        const doctor = await DataFind(`SELECT dl.medicine_payout, COALESCE(gs.d_min_withdraw, 0) AS d_min_withdraw
                                        FROM tbl_doctor_list AS dl
                                        LEFT JOIN tbl_general_settings AS gs ON 1 = 1
                                        WHERE dl.id = '${req.user.admin_id}'`);
        
        res.send({ status: doctor != '' ? true : false, doctor });
    } catch (error) {
        console.log(error);
        res.send({ status: false, doctor: [] });
    }
});

router.post("/product_wallet_withdraw", auth, async(req, res)=>{
    try {
        const { Withdraw_amount, spayment_type, upi_id, paypal_id, bank_no, bank_ifsc, bank_type } = req.body;

        const doctor = await DataFind(`SELECT dl.id, dl.medicine_payout, dl.success_medicine_payout, COALESCE(gs.d_min_withdraw, 0) AS d_min_withdraw
                                        FROM tbl_doctor_list AS dl
                                        LEFT JOIN tbl_general_settings AS gs ON 1 = 1
                                        WHERE dl.id = '${req.user.admin_id}'`);

        if (doctor.length === 0) {
            console.error("Data Not Found!");
            return res.redirect("back");
        }

        if (parseFloat(doctor[0].medicine_payout) >= parseFloat(doctor[0].d_min_withdraw)) {
            const date = new Date().toISOString();

            if (parseFloat(Withdraw_amount) >= parseFloat(doctor[0].d_min_withdraw) && parseFloat(Withdraw_amount) <= parseFloat(doctor[0].medicine_payout)) {

                let check = 0, wid;
                if (spayment_type == "1") {
                    check = 1;
                    if (await DataInsert(`tbl_doctor_product_payout_adjust`,
                        `order_id, doctor_id, amount, date, status, p_status, p_type, image, upi_id, paypal_id, bank_no, bank_ifsc, bank_type`,
                        `'', '${req.user.admin_id}', '${Withdraw_amount}', '${date}', '2', '0', '1', '', '${upi_id}', '', '', '', ''`, req.hostname, req.protocol) == -1) {
        
                        req.flash('errors', process.env.dataerror);
                        return res.redirect("/valid_license");
                    }
        
                } else if (spayment_type == "2") {
                    check = 1;
                    if (await DataInsert(`tbl_doctor_product_payout_adjust`,
                        `order_id, doctor_id, amount, date, status, p_status, p_type, image, upi_id, paypal_id, bank_no, bank_ifsc, bank_type`,
                        `'', '${req.user.admin_id}', '${Withdraw_amount}', '${date}', '2', '0', '2', '', '', '${paypal_id}', '', '', ''`, req.hostname, req.protocol) == -1) {
        
                        req.flash('errors', process.env.dataerror);
                        return res.redirect("/valid_license");
                    }
                                    
                } else if (spayment_type == "3") {
                    check = 1;
                    if (await DataInsert(`tbl_doctor_product_payout_adjust`,
                        `order_id, doctor_id, amount, date, status, p_status, p_type, image, upi_id, paypal_id, bank_no, bank_ifsc, bank_type`,
                        `'', '${req.user.admin_id}', '${Withdraw_amount}', '${date}', '2', '0', '3', '', '', '', '${bank_no}', '${bank_ifsc}', '${bank_type}'`, req.hostname, req.protocol) == -1) {
        
                        req.flash('errors', process.env.dataerror);
                        return res.redirect("/valid_license");
                    }
        
                }

                if (check == "1") {
                    let total = parseFloat((Number(doctor[0].medicine_payout) - Number(Withdraw_amount)).toFixed(2));
                    let success_payout = parseFloat((Number(doctor[0].success_medicine_payout) + Number(Withdraw_amount)).toFixed(2));
                    
                    if (await DataUpdate(`tbl_doctor_list`, `medicine_payout = '${total}', success_medicine_payout = '${success_payout}'`, `id = '${doctor[0].id}'`, req.hostname, req.protocol) == -1) {
                        return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
                    }
                }

                req.flash('success', 'Wallet Withdraw Request add successfully');
                res.redirect("/user/medicine_wallet");
                return;
            }   

            if (parseFloat(Withdraw_amount) < parseFloat(doctor[0].d_min_withdraw)) req.flash('errors', `Minimum Withdrawal Amount ${parseFloat(doctor[0].d_min_withdraw)}`);
            if (parseFloat(Withdraw_amount) > parseFloat(doctor[0].medicine_payout)) req.flash('errors', `Maximum Withdrawal Amount ${parseFloat(doctor[0].medicine_payout)}`);
            res.redirect("/user/medicine_wallet");
            return;
        }
        req.flash('errors', `Minimum Withdrawal Amount ${parseFloat(doctor[0].d_min_withdraw)}`);
        res.redirect("/user/medicine_wallet");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/medicine_payout_history", auth, async(req, res)=>{
    try {
        const doctor = await DataFind(`SELECT medicine_payout, success_medicine_payout FROM tbl_doctor_list WHERE id = '${req.user.admin_id}'`);
        if(doctor == '') {
            req.flash('errors', `User not found!`);
            return res.redirect("back");
        }

        const app = await DataFind(`SELECT id, order_id, doctor_id, amount, date, status, p_status, image, p_type
                                    FROM tbl_doctor_product_payout_adjust WHERE doctor_id = '${req.user.admin_id}' ORDER BY id DESC`);
                                    
        app.map(val => {
            val.date = new Date(val.date).toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })
        });
        
        res.render('doc_payout_medicine_his', {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, doctor, payout_list: app
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

// ============= Sitter Wallet ================ //

router.get("/vitals_physical", auth, async(req, res)=>{
    try {
        const vit_phy_list = await DataFind(`SELECT * FROM tbl_doctor_vitals_physical WHERE doctor_id = '${req.user.admin_id}' ORDER BY id DESC`);

        res.render('doctor_vit_phy', {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, vit_phy_list
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/add_vit_phy", auth, async(req, res)=>{
    try {
        const { title, status } = req.body;
        
        const estitele = mysql.escape(title), statuss = status == "on" ? 1 : 0;

        if (await DataInsert(`tbl_doctor_vitals_physical`, `doctor_id, title, status`, `'${req.user.admin_id}', ${estitele}, '${statuss}'`, req.hostname, req.protocol) == -1) {

            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Information Add successfully');
        res.redirect("/user/vitals_physical");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/edit_vit_phy/:id", auth, async(req, res)=>{
    try {
        const { title, status } = req.body;
        
        const estitele = mysql.escape(title), statuss = status == "on" ? 1 : 0;

        if (await DataUpdate(`tbl_doctor_vitals_physical`, `title = ${estitele}, status = '${statuss}'`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Information edit successfully');
        res.redirect("/user/vitals_physical");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/delete_vit_phy/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_doctor_vitals_physical`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Information delete successfully');
        res.redirect("/user/vitals_physical");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});



// ============= Medicine List ================ //

router.get("/medicine_list", auth, async(req, res)=>{
    try {
        const vit_phy_list = await DataFind(`SELECT * FROM tbl_doctor_medicine WHERE doctor_id = '${req.user.admin_id}' ORDER BY id DESC`);

        res.render('doctor_medicine_list', {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, vit_phy_list
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/add_medicine", auth, async(req, res)=>{
    try {
        const { name, status } = req.body;
        
        const estitele = mysql.escape(name), statuss = status == "on" ? 1 : 0;

        if (await DataInsert(`tbl_doctor_medicine`, `doctor_id, name, status`, `'${req.user.admin_id}', ${estitele}, '${statuss}'`, req.hostname, req.protocol) == -1) {

            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Medicine Add successfully');
        res.redirect("/user/medicine_list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/edit_medicine/:id", auth, async(req, res)=>{
    try {
        const { name, status } = req.body;
        
        const estitele = mysql.escape(name), statuss = status == "on" ? 1 : 0;

        if (await DataUpdate(`tbl_doctor_medicine`, `name = ${estitele}, status = '${statuss}'`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Medicine edit successfully');
        res.redirect("/user/medicine_list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/delete_medicine/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_doctor_medicine`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Medicine delete successfully');
        res.redirect("/user/medicine_list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});



// ============= Diagnosis test List ================ //

router.get("/diagnosis_test", auth, async(req, res)=>{
    try {
        const diagnosis_list = await DataFind(`SELECT * FROM tbl_doctor_diagnosis_test WHERE doctor_id = '${req.user.admin_id}' ORDER BY id DESC`);

        res.render('doctor_diagnosis_test', {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, diagnosis_list
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/add_diagnosis", auth, async(req, res)=>{
    try {
        const { name, description, status } = req.body;
        
        const estitele = mysql.escape(name), esdes = mysql.escape(description), statuss = status == "on" ? 1 : 0;

        if (await DataInsert(`tbl_doctor_diagnosis_test`, `doctor_id, name, description, status`, `'${req.user.admin_id}', ${estitele}, ${esdes}, '${statuss}'`, 
            req.hostname, req.protocol) == -1) {

            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Diagnosis test Add successfully');
        res.redirect("/user/diagnosis_test");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/edit_diagnosis/:id", auth, async(req, res)=>{
    try {
        const { name, description, status } = req.body;
        
        const estitele = mysql.escape(name), esdes = mysql.escape(description), statuss = status == "on" ? 1 : 0;

        if (await DataUpdate(`tbl_doctor_diagnosis_test`, `name = ${estitele}, description = ${esdes}, status = '${statuss}'`, `id = '${req.params.id}'`, 
            req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Diagnosis test edit successfully');
        res.redirect("/user/diagnosis_test");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/delete_diagnosis/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_doctor_diagnosis_test`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Diagnosis test delete successfully');
        res.redirect("/user/diagnosis_test");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});






// ============= Receptionist List ================ //

router.get("/receptionist_list", auth, async(req, res)=>{
    try {
        const Country_name = countryCodes.customList('countryCode', '{countryCode}');
        const nameCode = Object.values(Country_name);
        const myCountryCodesObject = countryCodes.customList('countryCode', '+{countryCallingCode}');
        const CountryCode = Object.values(myCountryCodesObject);
        const recep_list = await DataFind(`SELECT * FROM tbl_doctor_receptionist WHERE doctor_id = '${req.user.admin_id}' ORDER BY id DESC`);

        res.render('doctor_receptionist', {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, recep_list, nameCode, CountryCode
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/add_receptionist_data", auth, async(req, res)=>{
    try {
        const { country_code, phone, password, status } = req.body;
        
        const phoneExists = await DataFind(`SELECT phone FROM tbl_doctor_list WHERE country_code = '${country_code}' AND phone = '${phone}'
                                            UNION SELECT phone FROM tbl_lab_list WHERE country_code = '${country_code}' AND phone = '${phone}'
                                            UNION SELECT phone FROM tbl_doctor_receptionist WHERE country_code = '${country_code}' AND phone = '${phone}'
                                            UNION SELECT phone FROM tbl_admin WHERE country_code = '${country_code}' AND phone = '${phone}'`);

        if (phoneExists != '') return res.send({ status: false });

        const hash = await bcrypt.hash(password, 10), statuss = status == 'true' ? 1 : 0;

        if (await DataInsert(`tbl_doctor_receptionist`, `doctor_id, country_code, phone, password, status`, `'${req.user.admin_id}', '${country_code}', '${phone}', '${hash}', '${statuss}'`, 
            req.hostname, req.protocol) == -1) {
            
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        return res.send({ status: true });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/edit_receptionist/:id", auth, async(req, res)=>{
    try {
        const { country_code, phone, password, status } = req.body;
        
        const receptionist = await DataFind(`SELECT * FROM tbl_doctor_receptionist WHERE doctor_id = '${req.user.admin_id}' AND id = '${req.params.id}'`);

        if (receptionist != '') {
            const hash = password != '' ? await bcrypt.hash(password, 10) : receptionist[0].password;
            const statuss = status == "true" ? 1 : 0;
    
            if (receptionist[0].country_code != country_code || receptionist[0].phone != phone) {
                const ec = await DataFind(`SELECT phone FROM tbl_doctor_list WHERE country_code = '${country_code}' AND phone = '${phone}'
                                            UNION SELECT phone FROM tbl_lab_list WHERE country_code = '${country_code}' AND phone = '${phone}'
                                            UNION SELECT phone FROM tbl_doctor_receptionist WHERE country_code = '${country_code}' AND phone = '${phone}'
                                            UNION SELECT phone FROM tbl_admin WHERE country_code = '${country_code}' AND phone = '${phone}'`);
                if (ec != '') {
                    return res.send({ status: false, error: 1 });
                }
            }
    
            if (await DataUpdate(`tbl_doctor_receptionist`, `country_code = '${country_code}', phone = '${phone}', password = '${hash}', status = '${statuss}'`, 
                `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
                
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
        } else return res.send({ status: false, error: 2 });

        return res.send({ status: true, error: 0 });
    } catch (error) {
        console.log(error);
        return res.send({ status: false, error: 0 });
    }
});

router.get("/delete_receptionist/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_doctor_receptionist`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Receptionist delete successfully');
        res.redirect("/user/receptionist_list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});





module.exports = router;
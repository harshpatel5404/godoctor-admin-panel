/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */


const express = require("express");
const router = express.Router();
const multer  = require('multer');
const auth = require("../middleware/auth");
const AllFunction = require("../route_function/function");
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/database_query");

AllFunction.ImageUploadFolderCheck(`./public/uploads/services`);
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/services");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const upload = multer({storage : storage});

router.get("/add", auth, async(req, res)=>{
    try {
        
        res.render("add_services", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/view", auth, async(req, res)=>{
    try {
        const services_data = await DataFind(`SELECT * FROM tbl_services`);
        
        res.render("services", {
            auth:req.user, services_data, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/add_data", auth, upload.single('image'), async(req, res)=>{
    try {
        const {name, status} = req.body;

        const imageUrl = req.file ? "uploads/services/" + req.file.filename : null;
        const status_no = status == "on" ? 1 : 0;

        if (await DataInsert(`tbl_services`, `image, name, status`, `'${imageUrl}', '${name}', '${status_no}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Services Add successfully');
        res.redirect("/services/view");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/edit/:id", auth, async(req, res)=>{
    try {
        const services_data = await DataFind(`SELECT * FROM tbl_services WHERE id = '${req.params.id}'`);
        
        res.render("edit_services", {
            auth:req.user, services_data, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/edit_data/:id", auth, upload.single('image'), async(req, res)=>{
    try {
        const {name, status, service_old_img} = req.body;

        const imageUrl = req.file ? "uploads/services/" + req.file.filename : service_old_img;
        const status_no = status == "on" ? 1 : 0;

        if (await DataUpdate(`tbl_services`, `image = '${imageUrl}', name = '${name}', status = '${status_no}'`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Services Updated successfully');
        res.redirect("/services/view");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/delete/:id", auth, async(req, res)=>{
    try {
        if (await DataDelete(`tbl_services`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Services Deleted successfully');
        res.redirect("/services/view");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

module.exports = router;
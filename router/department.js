/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */


const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const multer  = require('multer');
let mysql = require('mysql2');
const AllFunction = require("../route_function/function");
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/database_query");


const cusImage = `./public/uploads/department`;
AllFunction.ImageUploadFolderCheck(cusImage);
const storage1 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/department");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const department = multer({storage : storage1});

// ============= Department ================ //

router.get("/add", auth, async(req, res)=>{
    try {

        res.render("add_department", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname
        })
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/add_department_data", auth, department.single('image'), async(req, res)=>{
    try {
        const {name, status} = req.body;
        
        const imageUrl = req.file ? "uploads/department/" + req.file.filename : null;
        let esname = mysql.escape(name), statuss = status == "on" ? 1 : 0;

        if (await DataInsert(`tbl_department_list`, `image, name, status`, `'${imageUrl}', ${esname}, '${statuss}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Department Add successfully');
        res.redirect("/department/list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
})

router.get("/list", auth, async(req, res)=>{
    try {
        const department_list = await DataFind(`SELECT * FROM tbl_department_list ORDER BY id DESC`);

        res.render("list_department", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, department_list
        })
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/edit/:id", auth, async(req, res)=>{
    try {
        const department_list = await DataFind(`SELECT * FROM tbl_department_list WHERE id = '${req.params.id}'`);
        
        res.render("edit_department", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, department_list:department_list[0]
        })
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/edit_department_data/:id", auth, department.single('image'), async(req, res)=>{
    try {
        const {name, status} = req.body;

        let esname = mysql.escape(name), imageUrl = null, statuss = status == "on" ? 1 : 0;

        const department_list = await DataFind(`SELECT * FROM tbl_department_list WHERE id = '${req.params.id}'`);
        if (req.file) {
            await AllFunction.DeleteImage(department_list[0].image);
            imageUrl = "uploads/department/" + req.file.filename;
        } else imageUrl = department_list[0].image;

        if (await DataUpdate(`tbl_department_list`, `image = '${imageUrl}', name = ${esname}, status = '${statuss}'`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Department Updated successfully');
        res.redirect("/department/list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
})

router.get("/delete/:id", auth, async(req, res)=>{
    try {
        const department = await DataFind(`SELECT * FROM tbl_department_list WHERE id = '${req.params.id}'`);

        await AllFunction.DeleteImage(department[0].image);
        if (await DataDelete(`tbl_department_list`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Department Deleted successfully');
        res.redirect("/department/list");
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
})





module.exports = router;
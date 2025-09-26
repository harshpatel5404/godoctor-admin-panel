/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */


const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const multer  = require('multer');
let mysql = require('mysql');
const countryCodes = require('country-codes-list');
const path = require("path");
const fs = require('fs-extra');
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/database_query");
const sendOneNotification = require("../middleware/send");
const AllFunction = require("../route_function/function");



async function DeleteImage(imgpath) {
    const folder_path = path.resolve(__dirname, "../public/" + imgpath);
    if (fs.existsSync(folder_path)) {
        fs.remove(folder_path, (err) => {
            if (err) {
                console.error('Error deleting file:');
                return false;
            }
            console.log('Image deleted successfully.');
        });
        return true;
    }
    return false;
}

// ============= Setting ================ //

AllFunction.ImageUploadFolderCheck(`./public/uploads/store_image`);
const storage3 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/store_image");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const store_image = multer({storage : storage3});

router.get("/store_setting", auth, async(req, res)=>{
    try {
        const Country_name = countryCodes.customList('countryCode', '{countryCode}');
        const nameCode = Object.values(Country_name);
        const myCountryCodesObject = countryCodes.customList('countryCode', '+{countryCallingCode}');
        const CountryCode = Object.values(myCountryCodesObject);
        const psetting = await DataFind(`SELECT * FROM tbl_doctor_store_detail WHERE doctor_id = '${req.user.admin_id}'`); 
        const ssd = psetting != '' ? psetting[0] : {id:0, doctor_id: "", image: "", name: "", address: "", country_code: "", phone: "", status: ""}

        res.render("doctor_product_setting", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, nameCode, CountryCode, ssd, psetting
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/check_store_detail", auth, async(req, res)=>{
    try {
        const {sname, sccode, sphone} = req.body;
        
        let snc = 0, scpc = 0;
        if (sname != '') {
            const sn = await DataFind(`SELECT * FROM tbl_doctor_store_detail WHERE name = '${sname}'`); 
            if (sn != '') snc = 1;
        }

        if (sccode != '' || sphone != '') {
            const scp = await DataFind(`SELECT * FROM tbl_doctor_store_detail WHERE country_code = '${sccode}' AND phone = '${sphone}'`); 
            if (scp != '') scpc = 1;
        }
        
        res.send({snc, scpc});
    } catch (error) {
        console.log(error);
        res.send({snc:2, scpc:2});
    }
});

router.post("/update_product_setting", auth, store_image.single('image'), async(req, res)=>{
    try {
        const {sname, saddress, country_code, phone, status} = req.body;

        const esname = mysql.escape(sname), eaddress = mysql.escape(saddress), statuss = status == "on" ? 1 : 0;
        const psetting = await DataFind(`SELECT * FROM tbl_doctor_store_detail WHERE doctor_id = '${req.user.admin_id}'`);

        let imageUrl = '';
        if (psetting == '') {
            imageUrl = req.file ? "uploads/store_image/" + req.file.filename : null;
            if (await DataInsert(`tbl_doctor_store_detail`, `doctor_id, image, name, address, country_code, phone, status`,
                `'${req.user.admin_id}', '${imageUrl}', ${esname}, ${eaddress}, '${country_code}', '${phone}', '${statuss}'`, req.hostname, req.protocol) == -1) {
            
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
            
        } else {
            if (req.file) {
                await AllFunction.DeleteImage(psetting[0].image);
                imageUrl = req.file ? "uploads/store_image/" + req.file.filename : null;
            } else imageUrl = psetting[0].image;

            if (await DataUpdate(`tbl_doctor_store_detail`, `image = '${imageUrl}', name = ${esname}, address = ${eaddress}, country_code = '${country_code}', 
                phone = '${phone}', status = '${statuss}'`, `doctor_id = '${req.user.admin_id}'`, req.hostname, req.protocol) == -1) {
            
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }  
        }
        
        req.flash('success', 'Store detail update successfully');
        res.redirect("/user/store_setting")
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});



// ============= Subcategory ================ //

AllFunction.ImageUploadFolderCheck(`./public/uploads/subcategory`);
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/subcategory");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);
    }
});

const subcategory = multer({storage : storage});

router.get("/add_subcategory", auth, async(req, res)=>{
    try {
        const scategory = await DataFind(`SELECT * FROM tbl_store_category`);
        console.log(scategory);
        
        res.render("add_store_subcategory", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, scategory
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/add_subservice_data", auth, subcategory.single('image'), async(req, res)=>{
    try {
        const {category_id, name, status} = req.body;

        const imageUrl = req.file ? "uploads/subcategory/" + req.file.filename : null;
        const statuss = status == "on" ? 1 : 0;
        const esname = mysql.escape(name);

        if (await DataInsert(`tbl_store_subcategory`, `doctor_id, category_id, image, name, status`,
            `'${req.user.admin_id}', '${category_id}', '${imageUrl}', ${esname}, '${statuss}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Subcategory Add successfully');
        res.redirect("/user/subcategory")
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/subcategory", auth, async(req, res)=>{
    try {
        const subdata_data = await DataFind(`SELECT sub.id, COALESCE(sc.name, '') AS service_name, sub.image, sub.name, sub.status
                                            FROM tbl_store_subcategory AS sub
                                            LEFT JOIN tbl_store_category AS sc ON sc.id = sub.category_id
                                            WHERE sub.doctor_id = '${req.user.admin_id}' ORDER BY sub.id DESC`);
        
        res.render("doctor_store_subcategory", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, subdata_data
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/edit_subcategory/:id", auth, async(req, res)=>{
    try {
        const scategory = await DataFind(`SELECT * FROM tbl_store_category`);
        const subdata = await DataFind(`SELECT * FROM tbl_store_subcategory WHERE id = '${req.params.id}'`);
        
        res.render("edit_store_subcategory", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, scategory, subdata:subdata[0]
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/edit_subservice_data/:id", auth, subcategory.single('image'), async(req, res)=>{
    try {
        const {service_id, name, status} = req.body;

        const subdata = await DataFind(`SELECT * FROM tbl_store_subcategory WHERE id = '${req.params.id}'`);

        let imageUrl = "";
        if (req.file) {
            imageUrl = "uploads/subcategory/" + req.file.filename;
            await DeleteImage(subdata[0].image);
        } else imageUrl = subdata[0].image;

        const esname = mysql.escape(name), statuss = status == "on" ? 1 : 0;

        if (await DataUpdate(`tbl_store_subcategory`, `category_id = '${service_id}', image = '${imageUrl}', name = ${esname}, status = '${statuss}'`, 
            `id = '${req.params.id}' AND doctor_id = '${req.user.admin_id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }  
        
        req.flash('success', 'Subcategory Updated successfully');
        res.redirect("/user/subcategory")
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/delete_subservice_data/:id", auth, async(req, res)=>{
    try {
        const subdata = await DataFind(`SELECT * FROM tbl_store_subcategory WHERE id = '${req.params.id}'`);

        if (subdata != '') {
            await DeleteImage(subdata[0].image);
            if (await DataDelete(`tbl_store_subcategory`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
            
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
            
            req.flash('success', 'Subcategory Delete successfully');
        } else req.flash('error', 'Product not found!');
        res.redirect("/user/subcategory")
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});





// ============= Sitter Product ================ //

router.get("/add_product", auth, async(req, res)=>{
    try {
        const subser_data = await DataFind(`SELECT sc.id, sc.name, COALESCE(stc.name, '') AS sname
                                            FROM tbl_store_subcategory AS sc
                                            LEFT JOIN tbl_store_category AS stc ON sc.category_id = stc.id
                                            WHERE doctor_id = '${req.user.admin_id}'`);
        
        res.render("add_doctor_product", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, subser_data
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

AllFunction.ImageUploadFolderCheck(`./public/uploads/product`);
const storage1 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/product");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const product = multer({storage : storage1});

router.post("/add_product_data", auth, product.array('image'), async(req, res)=>{
    let images = '', eptitle = [], ebasepri = [], eprice = [], ediscount = [], pd = [];

    for (let i = 0; i < req.files.length;) {
        images += req.files[i] ? (images === '' ? "uploads/product/" + req.files[i].filename : `&!!uploads/product/${req.files[i].filename}`) : '';
        i++;
    }

    try {
        const {product_name, sub_category_id, description, pro_type, prescription_require, price_title, base_price, price, discount, status} = req.body;

        eptitle = typeof price_title == "string" ? [price_title] : [...price_title];
        ebasepri = typeof base_price == "string" ? [base_price].map(val => Number(val)) : [...base_price].map(val => Number(val));
        eprice = typeof price == "string" ? [price].map(val => Number(val)) : [...price].map(val => Number(val));
        ediscount = typeof discount == "string" ? [discount].map(val => Number(val)) : [...discount].map(val => Number(val));

        for (let i = 0; i < eptitle.length;) {
            pd.push({
                title: eptitle[i],  
                base_price: ebasepri[i],  
                price: eprice[i],
                discount: ediscount[i]
            });
            i++;
        }
        
        if (await DataInsert(`tbl_doctor_store_product`, `doctor_id, sub_category_id, product_image, product_name, description, pro_type, prescription_require, price_detail, status`, 
            `'${req.user.admin_id}', '${sub_category_id}', '${images}', ${mysql.escape(product_name)}, ${mysql.escape(description)}, '${pro_type}', '${prescription_require}', 
            '${JSON.stringify(pd)}', '${status == "on" ? 1 : 0}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }
        
        req.flash('success', 'Product Add successfully');
        res.redirect("/user/product");

    } catch (error) {

        if (images != '') {
            const es_image = images.split("&!!");
            for (let a = 0; a < es_image.length;) {
                await AllFunction.DeleteImage(es_image[a]);
                a++;
            }
        }
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});



router.get("/product", auth, async(req, res)=>{
    try {
        const subdata_data = await DataFind(`SELECT pro.id, pro.product_image, pro.product_name, pro.description, pro.status,
                                            COALESCE(cate.name, '') AS category_name, COALESCE(subs.name, '') AS subser_name
                                            FROM tbl_doctor_store_product AS pro
                                            LEFT JOIN tbl_store_subcategory AS subs ON pro.sub_category_id = subs.id
                                            LEFT JOIN tbl_store_category AS cate ON subs.category_id = cate.id
                                            WHERE pro.doctor_id = '${req.user.admin_id}' ORDER BY id DESC`);
        
        subdata_data.map(pval => {
            pval.product_image = pval.product_image.split("&!!")[0];
        });
        
        res.render("doctor_product", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, subdata_data
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/edit_product/:id", auth, async(req, res)=>{
    try {
        const subser_data = await DataFind(`SELECT sc.id, sc.name, COALESCE(stc.name, '') AS sname
                                            FROM tbl_store_subcategory AS sc
                                            LEFT JOIN tbl_store_category AS stc ON sc.category_id = stc.id
                                            WHERE doctor_id = '${req.user.admin_id}'`);
        
        const subdata = await DataFind(`SELECT * FROM tbl_doctor_store_product WHERE id = '${req.params.id}'`);
        console.log(subdata[0].price_detail);
        
        subdata.map(pval => {
            pval.product_image = pval.product_image.split("&!!");
        });
        
        res.render("edit_doctor_product", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, subser_data, product:subdata[0]
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/delete_pro_image", auth, async(req, res)=>{
    try {
        const {id, img} = req.body;
        
        const customer = await DataFind(`SELECT id, product_image FROM tbl_doctor_store_product WHERE id = '${id}'`);
        
        let vid = "", dvid = "";
        if (customer != "") {
            let videos = customer[0].product_image.split("&!!");
            for (let i = 0; i < videos.length;) {
                if (videos[i] != img) vid += vid == "" ? videos[i] : `&!!${videos[i]}`;
                else dvid = videos[i]
                i++;
            }
            
            if (dvid != "") {
                await DeleteImage(dvid);
            }

            if (vid != "" || videos.length == 1) {
                if (await DataUpdate(`tbl_doctor_store_product`, `product_image = '${vid}'`, `id = '${customer[0].id}'`, req.hostname, req.protocol) == -1) {
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
})

router.post("/edit_product_data/:id", auth, product.array('image'), async(req, res)=>{
    try {
        const {product_name, sub_category_id, description, pro_type, prescription_require, price_title, base_price, price, discount, status} = req.body;

        const customer = await DataFind(`SELECT id, product_image FROM tbl_doctor_store_product WHERE id = '${req.params.id}'`);
        let images = '', imglist = '', eptitle = [], ebasepri = [], eprice = [], ediscount = [];
        if (req.files) {
            for (let i = 0; i < req.files.length;) {
                images += req.files[i] ? (images === '' ? "uploads/product/" + req.files[i].filename : `&!!uploads/product/${req.files[i].filename}`) : '';
                i++;
            }
        }
        
        if (images != '') {
            if (customer[0].product_image != '') imglist = `${customer[0].product_image}&!!${images}`;
            else imglist = images;
        } else imglist = customer[0].product_image;

        let statuss = status == "on" ? 1 : 0, esname = mysql.escape(product_name), esdes = mysql.escape(description), pd = [];

        eptitle = typeof price_title == "string" ? [price_title] : [...price_title];
        ebasepri = typeof base_price == "string" ? [base_price].map(val => Number(val)) : [...base_price].map(val => Number(val));
        eprice = typeof price == "string" ? [price].map(val => Number(val)) : [...price].map(val => Number(val));
        ediscount = typeof discount == "string" ? [discount].map(val => Number(val)) : [...discount].map(val => Number(val));

        for (let i = 0; i < eptitle.length;) {
            pd.push({
                title: eptitle[i],  
                base_price: ebasepri[i],  
                price: eprice[i],  
                discount: ediscount[i]
            });
            i++;
        }

        if (await DataUpdate(`tbl_doctor_store_product`, `sub_category_id = '${sub_category_id}', product_image = '${imglist}', product_name = ${esname}, description = ${esdes},
            pro_type = '${pro_type}', prescription_require = '${prescription_require}', price_detail = '${JSON.stringify(pd)}', status = '${statuss}'`, 
            `id = '${req.params.id}' AND doctor_id = '${req.user.admin_id}'`, req.hostname, req.protocol) == -1) {
        
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }  
        
        req.flash('success', 'Product Updated successfully');
        res.redirect("/user/product")
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.get("/delete_product_data/:id", auth, async(req, res)=>{
    try {
        const product = await DataFind(`SELECT id, product_image FROM tbl_doctor_store_product WHERE id = '${req.params.id}'`);

        if (product != '') {
            const img = product[0].product_image.split("&!!");
            
            for (let i = 0; i < img.length;) {
                await AllFunction.DeleteImage(img[i]);
                i++
            }

            if (await DataDelete(`tbl_doctor_store_product`, `id = '${req.params.id}'`, req.hostname, req.protocol) == -1) {
            
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
            
            req.flash('success', 'Product Delete successfully');
        } else req.flash('error', 'Product not found!');
        res.redirect("/user/product")
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});



// ============= Sitter Product ================ //

AllFunction.ImageUploadFolderCheck(`./public/uploads/sub_banner`);
const storage2 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/sub_banner");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const banner = multer({storage : storage2});

router.get("/banner", auth, async(req, res)=>{
    try {
        const bannerd = await DataFind(`SELECT * FROM tbl_doctor_subcategory_banner WHERE doctor_id = '${req.user.admin_id}'`);
        bannerd.map(val => {
            val.images = val.images.split("&!!");
        })
        
        res.render("doctor_subcategory_banner.ejs", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, bannerd
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post("/add_sub_banner", auth, banner.array('image'), async(req, res)=>{
    try {
        if (req.files) {
            const bannerd = await DataFind(`SELECT * FROM tbl_doctor_subcategory_banner WHERE doctor_id = '${req.user.admin_id}'`);

            let images = '', imglist = [];
            for (let i = 0; i < req.files.length;) {
                let imgl = req.files[i] ? (images === '' ? "uploads/sub_banner/" + req.files[i].filename : `&!!uploads/sub_banner/${req.files[i].filename}`) : '';
                images += imgl;
                i++;
            }
            
            if (bannerd != '') {
                if (bannerd[0].images != '') {
                    images = `${images}&!!${bannerd[0].images}`;
                }

                if (await DataUpdate(`tbl_doctor_subcategory_banner`, `images = '${images}'`, `id = '${bannerd[0].id}'`, req.hostname, req.protocol) == -1) {
                
                    req.flash('errors', process.env.dataerror);
                    return res.redirect("/valid_license");
                }
            } else {
                if (await DataInsert(`tbl_doctor_subcategory_banner`, `doctor_id, images`, `'${req.user.admin_id}', '${images}'`, req.hostname, req.protocol) == -1) {
                
                    req.flash('errors', process.env.dataerror);
                    return res.redirect("/valid_license");
                }
            }
            
            imglist = images.split("&!!");
            
            req.flash('success', 'Banner Add successfully');
            return res.status(200).json({ status: true, imglist, uid:req.user.admin_id, edit: req.lan.ld.Edit, Banner: req.lan.ld.Banner, Image: req.lan.ld.Image });
        }
        return res.status(200).json({ status: false });
    } catch (error) {
        console.log(error);
        return res.status(200).json({ status: false });
    }
});

router.post("/edit_sub_banner", auth, banner.single('image'), async(req, res)=>{
    try {
        const {biuid} = req.body;
        
        if (req.file && biuid) {
            let images = '', nimg = '';
            
            const bannerd = await DataFind(`SELECT * FROM tbl_doctor_subcategory_banner WHERE doctor_id = '${req.user.admin_id}'`);
            if (bannerd != '') {
                
                bannerd.map(val => {
                    val.images = val.images.split("&!!") 
                })
    
                for (let i = 0; i < bannerd[0].images.length;) {
                    if (biuid == bannerd[0].images[i]) {
                        
                        await DeleteImage(bannerd[0].images[i]);
                        images += images == '' ? `uploads/sub_banner/${req.file.filename}` : `&!!uploads/sub_banner/${req.file.filename}`;
                        nimg = `uploads/sub_banner/${req.file.filename}`
                    }
                    else images += images == '' ? bannerd[0].images[i] : `&!!${bannerd[0].images[i]}`;
                    i++;
                }
                
                if (await DataUpdate(`tbl_doctor_subcategory_banner`, `images = '${images}'`, `id = '${bannerd[0].id}'`, req.hostname, req.protocol) == -1) {
                    
                    req.flash('errors', process.env.dataerror);
                    return res.redirect("/valid_license");
                }
                return res.status(200).json({ status: true, biuid: nimg, edit: req.lan.ld.Edit });
            } else return res.status(200).json({ status: false, biuid: nimg, edit: req.lan.ld.Edit });
        }
        return res.status(200).json({ status: false, biuid: nimg, edit: req.lan.ld.Edit });
    } catch (error) {
        console.log(error);
        return res.status(200).json({ status: false });
    }
});

router.post("/delete_sub_banner", auth, async(req, res)=>{
    try {
        const {biuid} = req.body;
        
        if (biuid) {
            let images = ''
            
            const bannerd = await DataFind(`SELECT * FROM tbl_doctor_subcategory_banner WHERE doctor_id = '${req.user.admin_id}'`);
            if (bannerd != '') {
                
                bannerd.map(val => {
                    val.images = val.images.split("&!!") 
                })
    
                for (let i = 0; i < bannerd[0].images.length;) {
                    if (biuid != bannerd[0].images[i]) {
                        images += images == '' ? bannerd[0].images[i] : `&!!${bannerd[0].images[i]}`;
                    } else await DeleteImage(bannerd[0].images[i]);
                    i++;
                }
                if (images != '') {
                    if (await DataUpdate(`tbl_doctor_subcategory_banner`, `images = '${images}'`, `id = '${bannerd[0].id}'`, req.hostname, req.protocol) == -1) {
                        
                        req.flash('errors', process.env.dataerror);
                        return res.redirect("/valid_license");
                    }
                    return res.status(200).json({ status: true, c: 1 });
                } else {
                    if (await DataDelete(`tbl_doctor_subcategory_banner`, `id = '${bannerd[0].id}'`, req.hostname, req.protocol) == -1) {
        
                        req.flash('errors', process.env.dataerror);
                        return res.redirect("/valid_license");
                    }
                    return res.status(200).json({ status: true, c: 0, bnf: req.lan.ld.Banner_not_found });
                }
            } else return res.status(200).json({ status: false });
        }
        return res.status(200).json({ status: false });
    } catch (error) {
        console.log(error);
        return res.status(200).json({ status: false });
    }
});

// ============= Order list ================ //

router.get("/order_list", auth, async(req, res)=>{
    try {
        const order_list = await DataFind(`SELECT op.id, op.customer_id, op.status, op.tot_price, op.wallet, op.date, JSON_LENGTH(COALESCE(JSON_ARRAYAGG(jt.id), 
                                            JSON_ARRAY())) AS tot_product, COALESCE(cus.name, '') AS cus_name, COALESCE(payd.name, '') AS payment_name
                                            FROM tbl_order_product AS op
                                            JOIN JSON_TABLE(op.product_list, "$[*]"
                                                COLUMNS ( id INT PATH "$.id", qty INT PATH "$.qty" )
                                            ) AS jt
                                            LEFT JOIN tbl_customer AS cus ON cus.id = op.customer_id
                                            LEFT JOIN tbl_payment_detail AS payd ON payd.id = op.payment_id
                                            ${req.user.admin_role != 1 ? ` WHERE op.doctor_id = '${req.user.admin_id}'` : `` }
                                            GROUP BY op.id
                                            ORDER BY op.id DESC;`);

        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const formatOptions = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone };
        
        order_list.map(val => {
            val.date = new Date(val.date).toLocaleString('en-US', formatOptions);
            return val;
        });

        res.render("doctor_pro_order_list", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, order_list
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

// ============= Order list ================ //

router.get("/order_detail/:id", auth, async(req, res)=>{
    try {
        const or = await DataFind(`SELECT op.*, COALESCE(payd.name, '') AS payment_name, COALESCE(JSON_ARRAYAGG(jt.id), JSON_ARRAY()) AS ids, COALESCE(cus.image, '') AS image,
                                    COALESCE(cus.name, '') AS name, COALESCE(cus.email, '') AS email, COALESCE(cus.country_code, '') AS country_code, 
                                    COALESCE(cus.phone, '') AS phone, COALESCE(cus.pending_ref, '') AS pending_ref, COALESCE(cus.tot_balance, '') AS tot_balance,
                                    COALESCE(cl.title, '') AS cancel_title, COALESCE(op.cancel_reason, '') AS cancel_reason, op.transactionId, op.medicine_prescription AS medi_pres,
                                    JSON_OBJECT(
                                        's', CASE
                                            WHEN op.status = '0' THEN '${req.lan.ld.Pending}'
                                            WHEN op.status = '1' THEN '${req.lan.ld.Processing}'
                                            WHEN op.status = '2' THEN '${req.lan.ld.Ready_to_deliver}'
                                            WHEN op.status = '3' THEN '${req.lan.ld.Deliver}'
                                            WHEN op.status = '4' THEN '${req.lan.ld.Canceled}'
                                            ELSE ''
                                        END,
                                        'b', CASE
                                            WHEN op.status = '0' THEN 'btn-secondary'
                                            WHEN op.status = '1' THEN 'btn-info'
                                            WHEN op.status = '2' THEN 'btn-primary'
                                            WHEN op.status = '3' THEN 'btn-success'
                                            WHEN op.status = '4' THEN 'btn-danger'
                                            ELSE ''
                                        END
                                    ) AS status_type
                                    FROM tbl_order_product AS op
                                    JOIN
                                        JSON_TABLE(op.product_list, "$[*]"
                                            COLUMNS (
                                                id INT PATH "$.id", qty INT PATH "$.qty"
                                            )
                                        ) AS jt
                                    LEFT JOIN tbl_payment_detail AS payd ON payd.id = op.payment_id
                                    LEFT JOIN tbl_customer AS cus ON cus.id = op.customer_id
                                    LEFT JOIN tbl_appointment_cancel_list AS cl ON cl.id = op.cancel_id AND op.cancel_id != ''
                                    WHERE op.id = '${req.params.id}' ${req.user.admin_role != 1 ? ` AND op.doctor_id = '${req.user.admin_id}'` : `` }
                                    GROUP BY op.id;`);

        if (or == '') {
            req.flash('errors', `Order Not Found!`);
            return res.redirect("back");
        }
        
        or[0].product_list = typeof or[0].product_list == "string" ? JSON.parse(or[0].product_list) : or[0].product_list;
        or[0].medi_pres = typeof or[0].medi_pres == "string" ? JSON.parse(or[0].medi_pres) : or[0].medi_pres;
        or[0].ids = typeof or[0].ids == "string" ? JSON.parse(or[0].ids) : or[0].ids;
        
        if (or[0].wallet != 0 && or[0].payment_name != '') or[0].online_amount = Number((or[0].tot_price - or[0].wallet).toFixed(2));
        else if (or[0].wallet == 0 && or[0].payment_name != '') or[0].online_amount = or[0].tot_price;
        else or[0].online_amount = 0;
        
        let cplist = [], tot_price = 0;
        if (or[0].ids.length != 0) {

            const cstlist = await DataFind(`SELECT id, product_image, product_name, pro_type, prescription_require, price_detail
                                            FROM tbl_doctor_store_product
                                            WHERE id IN (${or[0].ids.join(',')}) AND status = '1'`);
            
            cstlist.forEach(val => {
                let csl = or[0].product_list.filter(nv => nv.id == val.id);
                
                if (csl != '') {
                    // let cval = []
                    csl.map(vval => {
                        let d = val.price_detail.find(val => val.title == vval.ptype);
                        cplist.push({
                            id: val.id,
                            product_image: val.product_image.split("&!!")[0],
                            product_name: val.product_name.length > 38 ? val.product_name.slice(0, 38) + '...' : val.product_name ,
                            pro_type: val.pro_type,
                            prescription_require: val.prescription_require,
                            price_detail: { "title": vval.ptype, "price": d ? d.price : 0, "bprice": d ? d.base_price : 0, "discount": d ? d.discount : 0, "qty": vval.qty }
                        });
                        
                        tot_price += vval.price * vval.qty; 
                    });

                }
            });
        }

        const date = new Date(or[0].date);
        const formattedDate = date.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }); 
        or[0].date = formattedDate;

        const ad = await DataFind(`SELECT * FROM tbl_customer_address WHERE id = '${or[0].address_id}'`);

        const cr = await DataFind(`SELECT id, title FROM tbl_appointment_cancel_list WHERE status = '1' ORDER BY id DESC;`);

        res.render("doctor_pro_order_detail", {
            auth:req.user, general:req.general, noti:req.notification, per:req.per, lan:req.lan.ld, land:req.lan.lname, appoint: or[0], product_list: cplist, tot_price,
            address: ad != '' ? ad[0] : {}, cr
        });
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});

router.post('/doc_order_cancel', auth, async (req, res) => {
    try {
        const {id, cul, oth} = req.body;
        
        const missingField = ["id", "cul"].find(field => !req.body[field]);
        if(missingField) return res.send({ status:false, message: "Something Went Wrong!" });
       
        const unorder = await DataFind(`SELECT ord.id, ord.customer_id, ord.doctor_id, ord.tot_price, COALESCE(cus.id, 0) as cid, COALESCE(cus.tot_balance, 0) as cbalance
                                        FROM tbl_order_product as ord
                                        JOIN tbl_customer as cus ON cus.id = ord.customer_id
                                        WHERE ord.id = '${id}'`);
        
        if (unorder == "") return res.send({ResponseCode: 200, Result:true, message: 'Order not found!' });
        
        let twallet = Number((Number(unorder[0].cbalance) + Number(unorder[0].tot_price)).toFixed(2)), date = new Date();
        
        if (await DataUpdate(`tbl_customer`, `tot_balance = '${twallet.toFixed(2)}'`, `id = '${unorder[0].cid}'`, req.hostname, req.protocol) == -1) {
            return res.send({ message: process.env.dataerror, status: false });
        }
    
        if (await DataInsert(`tbl_customer_wallet`, `customer_id, amount, date, payment_type, status, amount_type`,
            `'${unorder[0].cid}', '${unorder[0].tot_price}', '${date.toISOString().split("T")[0]}', '0', '3', '${unorder[0].id}'`, req.hostname, req.protocol) == -1) {
            
            return res.send({ message: process.env.dataerror, status: false });
        }
    
        const oreason = mysql.escape(oth);
        if (await DataUpdate(`tbl_order_product`, `status = '4', cancel_id = '${cul}', cancel_reason = ${oreason}`, `id = '${unorder[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.send({ message: process.env.dataerror, status: false });
        }

        let ms = `❌ Your order has been canceled. If this was a mistake, please contact support. Order ID : # ${unorder[0].id}`; 
        sendOneNotification(ms, 'customer', unorder[0].customer_id, 1);
        if (await DataInsert(`tbl_notification`, `order_id, customer_id, service_user_id, date, mstatus, ostatus, notification`,
            `'${unorder[0].id}', '${unorder[0].customer_id}', '${unorder[0].doctor_id}', '${AllFunction.NotificationDate(date)}', '3', '5', '${ms}'`, req.hostname, req.protocol) == -1) {

            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        const cancel_data = await DataFind(`SELECT * FROM tbl_appointment_cancel_list WHERE id = '${cul}'`);
       
        return res.send({ status: true, message: "Appointment Cancel Successfully.", title: req.lan.ld.Canceled, cancel_data, oth });
    } catch (error) {
        console.error(error);
        return res.send({ status:false, message: "Inrenal Servre Error!" });
    }
});

router.post('/doctor_order_status_change', auth, async (req, res) => {
    try {
        const {id, s} = req.body;
        
        const missingField = ["id", "s"].find(field => !req.body[field]);
        if(missingField) return res.send({ status:false, message: "Something Went Wrong!" });
       
        const op = await DataFind(`SELECT id, customer_id, doctor_id, status, tot_price, site_commission FROM tbl_order_product WHERE id = '${id}'`);
        if (op == "") return res.send({ status:true, message: 'Order not found!' });

        if (op[0].status == 3 || op[0].status == 4) return res.send({ status:false, message: "This Order Already Completed!" });

        let title = '', ns = '', nm = '', date = new Date();
        if (op[0].status == 0) {
            if (s != 1) return res.send({ status:false, message: "Please Complete Other Steps!" });
            title = req.lan.ld.Processing; ns = 2, nm = `💊 Your order is being processed. We'll notify you once it's ready to deliver. Order ID : # ${op[0].id}`;
        }

        if (op[0].status == 1) {
            if (s != 2) return res.send({ status:false, message: "Please Complete Other Steps!" });
            title = req.lan.ld.Ready_to_deliver; ns = 3, nm = `📦 Your order is packed and ready to be delivered. Order ID : # ${op[0].id}`;
        }

        if (op[0].status == 2) {
            if (s != 3) return res.send({ status:false, message: "Please Complete Other Steps!" });

            let sittl = await DataFind(`SELECT id, wallet, medicine_payout FROM tbl_doctor_list WHERE id = '${op[0].doctor_id}';`);
            if (sittl == "") return res.send({ status:false, message: "Data Not Found!" });

            let docamount = Number((Number(op[0].tot_price) - Number(op[0].site_commission)).toFixed(2));
            let swallet = Number((Number(sittl[0].wallet) + docamount).toFixed(2));
            let dmedpay = Number((Number(sittl[0].medicine_payout) + docamount).toFixed(2));

            if (await DataInsert(`tbl_doctor_product_payout_adjust`, `order_id, doctor_id, amount, date, status, p_status, p_type, image, upi_id, paypal_id, bank_no, 
                bank_ifsc, bank_type`,
                `'${op[0].id}', '${op[0].doctor_id}', '${docamount}', '${date.toISOString()}', '1', '', '', '', '', '', '', '', ''`, req.hostname, req.protocol) == -1) {
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }

            if (await DataUpdate(`tbl_doctor_list`, `wallet = '${swallet}', medicine_payout = '${dmedpay}'`, `id = '${op[0].doctor_id}'`, req.hostname, req.protocol) == -1) {
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }

            title = req.lan.ld.Deliver; ns = 3, nm = `🚚 Your order is out for delivery. Please keep your phone available. Order ID : # ${op[0].id}`;
        }
        
        if (await DataUpdate(`tbl_order_product`, `status = '${s}'`, `id = '${op[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.send({ message: process.env.dataerror, status: false });
        }

        if (ns != '' && nm != '') {
            sendOneNotification(nm, 'customer', op[0].customer_id, 1);
            if (await DataInsert(`tbl_notification`, `order_id, customer_id, service_user_id, date, mstatus, ostatus, notification`,
                `'${op[0].id}', '${op[0].customer_id}', '${op[0].doctor_id}', '${AllFunction.NotificationDate(date)}', '3', '${ns}', ${mysql.escape(nm)}`, req.hostname, req.protocol) == -1) {
    
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
        }
       
        return res.send({ status: true, message: "Appointment Update Successfully.", title });
    } catch (error) {
        console.error(error);
        return res.send({ status:false, message: "Inrenal Servre Error!" });
    }
});

// ============= Order status change ================ //

router.get("/p_order_status/:id", auth, async(req, res)=>{
    try {
        const st = req.params.id.split('&');
        
        const op = await DataFind(`SELECT id, status FROM tbl_order_product WHERE id = '${st[0]}'`);
        if (op == '') {
            req.flash('errors', `Order not found`);
            return res.redirect("back");
        }

        let status = ''
        if (st[1] == '0') {
            if (op[0].status == '0') status = '1'
            else if (op[0].status == '1') status = '2'
            else if (op[0].status == '2') status = '3'
        } else status = '4' 
        
        if (await DataUpdate(`tbl_order_product`, `status = '${status}'`, `id = '${op[0].id}'`, req.hostname, req.protocol) == -1) {
            req.flash('errors', process.env.dataerror);
            return res.redirect("/valid_license");
        }

        req.flash('success', 'Status update successfully');
        res.redirect("/user/p_order_list")
    } catch (error) {
        console.log(error);
        req.flash('errors', `Internal Server Error!`);
        return res.redirect("back");
    }
});



router.post('/product_details', auth, async (req, res) => {
    try {
        const {pid, ptype, pd} = req.body;
        
        const missingField = ["pid", "ptype"].find(field => !req.body[field]);
        if(missingField) return res.send({ status:false, message: "Data Not Found" });

        const cstlist = await DataFind(`SELECT sittp.id, sittp.product_image, sittp.product_name, sittp.pro_type, sittp.prescription_require, sittp.price_detail,
                                        COALESCE(subs.name, '') AS sub_category_name, COALESCE(cate.name, '') AS category_name,
                                        COALESCE(subs.image, '') AS sub_category_image, COALESCE(cate.image, '') AS category_image
                                        FROM tbl_doctor_store_product AS sittp
                                        LEFT JOIN tbl_store_subcategory AS subs ON subs.id = sittp.sub_category_id
                                        LEFT JOIN tbl_store_category AS cate ON cate.id = subs.category_id
                                        WHERE sittp.id = '${pid}'`);

        if (cstlist != '') {
            cstlist[0].product_image = cstlist[0].product_image.split("&!!")[0];
        }

        return res.send({ status:true, title: `${req.lan.ld.Canceled}`, message: "Appointment Cancel Successfully" });
    } catch (error) {
        console.error(error);
        return res.send({ status:false, message: "Inrenal Servre Error!" });
    }
});





module.exports = router;
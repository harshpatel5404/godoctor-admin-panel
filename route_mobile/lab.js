/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */


const express = require("express");
const router = express.Router();
const bcrypt = require('bcrypt');
const multer  = require('multer');
const mysql = require('mysql');
const fs = require('fs-extra');
const path = require("path");
const AllFunction = require("../route_function/function");
const sendOneNotification = require("../middleware/send");
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/database_query");



// ============= Signup ================ //

const storage2 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/lab");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const lab = multer({storage : storage2});

router.post("/lab_signup", lab.single('logo'), async(req, res)=>{
    const imageUrl = req.file ? "uploads/lab/" + req.file.filename : null;
    try {
        const {name, email, country_code, phone, password, lab_code, license_number, latitude, longitude, description, address} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["name", "email", "country_code", "phone", "password", "lab_code", "license_number", "latitude", "longitude", "description", "address"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const zonecec = await DataFind(`SELECT zon.name AS zone_name
                                        FROM tbl_zone AS zon
                                        WHERE zon.status = '1'
                                        AND ST_Contains(
                                            zon.lat_lon_polygon,
                                            ST_SRID(ST_GeomFromText(CONCAT('POINT(', ${Number(longitude)}, ' ', ${Number(latitude)}, ')')), 4326)
                                        );`);
                                        
        if (zonecec == '') {
            if(imageUrl != null) await AllFunction.DeleteImage(imageUrl);
            return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Location is not in the zone!'});
        }

        const emailExists = await DataFind(`SELECT email FROM tbl_doctor_list WHERE email = '${email}'
                                            UNION SELECT email FROM tbl_lab_list WHERE email = '${email}'
                                            UNION SELECT email FROM tbl_role_permission WHERE email = '${email}'
                                            UNION SELECT email FROM tbl_admin WHERE email = '${email}'`);
        
        if (emailExists && emailExists.length > 0) {
            if (imageUrl != null) await AllFunction.DeleteImage(imageUrl);
            return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Email already exists!' });
        }

        const phoneExists = await DataFind(`SELECT phone FROM tbl_doctor_list WHERE country_code = '${country_code}' AND phone = '${phone}'
                                            UNION SELECT phone FROM tbl_lab_list WHERE country_code = '${country_code}' AND phone = '${phone}'
                                            UNION SELECT phone FROM tbl_doctor_receptionist WHERE country_code = '${country_code}' AND phone = '${phone}'
                                            UNION SELECT phone FROM tbl_role_permission WHERE country_code = '${country_code}' AND phone = '${phone}'
                                            UNION SELECT phone FROM tbl_admin WHERE country_code = '${country_code}' AND phone = '${phone}'`);
        
        if (phoneExists && phoneExists.length > 0) {
            if (imageUrl != null) await AllFunction.DeleteImage(imageUrl);
            return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Mobile number already registered!' });
        }

        const gs = await DataFind(`SELECT lab_auto_approve FROM tbl_general_settings`);
        let ls = 0;
        if (gs != '') {
            if (gs[0].lab_auto_approve > 0 && !isNaN(gs[0].lab_auto_approve)) {
                ls = gs[0].lab_auto_approve
            }
        }
        
        let esname = mysql.escape(name), edesc = mysql.escape(description), eaddress = mysql.escape(address), hash = await bcrypt.hash(password, 10);
        
        if (await DataInsert(`tbl_lab_list`, `logo, name, email, country_code, phone, password, lab_code, status, description, license_number, address, latitude, longitude,
            wallet, cash_amount, success_cash, tot_payout, success_payout, join_date`, 
            `'${imageUrl}', ${esname}, '${email}', '${country_code}', '${phone}', '${hash}', '0', '${lab_code}', '${ls}', ${edesc}, '${license_number}', ${eaddress}, 
            '${latitude}', '${longitude}', '0', '0', '0', '0', '0', '${new Date().toISOString().split("T")[0]}'`, req.hostname, req.protocol) == -1) {
        
            if(imageUrl != null) await AllFunction.DeleteImage(imageUrl);
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }
        
        const lab_data = await DataFind(`SELECT * FROM tbl_lab_list WHERE country_code = '${country_code}' AND phone = '${phone}'`);
        if (lab_data == '') {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data not found!'});
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Signup Successfully', lab_data: lab_data[0] });
    } catch (error) {
        console.error(error);
        if(imageUrl != null) await AllFunction.DeleteImage(imageUrl);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.post("/update_lab_profile", lab.single('logo'), async(req, res)=>{
    let logo = req.file ? "uploads/lab/" + req.file.filename : null;
    try {
        const { id, name, email } = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "name", "email"], req.body);
        if (missingField.status == false) {
            if (req.file && logo != null) await AllFunction.DeleteImage(logo);
            return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });
        }

        const lab = await DataFind(`SELECT * FROM tbl_lab_list WHERE id = '${id}'`);
        if (id == '') {
            if (req.file && logo != null) await AllFunction.DeleteImage(logo);
            return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Lab not found!' });
        }

        if (req.file) {
            logo = req.file ? "uploads/lab/" + req.file.filename : null;
        } else logo = lab[0].logo;

        if (lab[0].email != email) {
            const emailExists = await DataFind(`SELECT email FROM tbl_doctor_list WHERE email = '${email}'
                                                UNION SELECT email FROM tbl_lab_list WHERE email = '${email}'
                                                UNION SELECT email FROM tbl_admin WHERE email = '${email}'`);

            if (emailExists && emailExists.length > 0) {
                if (req.file && logo != null) await AllFunction.DeleteImage(logo);
                return res.status(200).json({ ResponseCode: 401, Result: false, message: 'Email already exists!' });
            }
        }

        if (await DataUpdate(`tbl_lab_list`, `logo = '${logo}', name = '${name}', email = '${email}'`, `id = '${lab[0].id}'`, req.hostname, req.protocol) == -1) {

            if (req.file && logo != null) await AllFunction.DeleteImage(logo);
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        const lab_data = await DataFind(`SELECT * FROM tbl_lab_list WHERE id = '${id}'`);

        if (req.file) {
            await AllFunction.DeleteImage(lab[0].logo);
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', lab_data: lab_data[0] });
    } catch (error) {
        console.error(error);
        if (req.file && logo != null) await AllFunction.DeleteImage(logo);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// ============= Home ================ //

router.post("/lab_home", async(req, res)=>{
    try {
        const { id } = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const lab = await DataFind(`SELECT logo, name, email, wallet FROM tbl_lab_list WHERE id = '${id}' AND status = '1'`);
        if (lab == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'User not found!' });

        const general_setting = await DataFind(`SELECT site_currency, one_app_id, one_app_id_react, google_map_key, agora_app_id FROM tbl_general_settings`);

        const lab_pack = await DataFind(`SELECT COUNT(*) AS tot_package FROM tbl_lab_package_list WHERE lab_id = '${id}'`);
        const home_col = await DataFind(`SELECT COUNT(*) AS tot_home_col FROM tbl_lab_home_collect_user WHERE lab_id = '${id}'`);
        const coupon = await DataFind(`SELECT COUNT(*) AS tot_coupon FROM tbl_lab_coupon WHERE lab_id = '${id}'`);

        let data = [
            { field_name: "Packages", tot_no: lab_pack[0].tot_package },
            { field_name: "Collect User", tot_no: home_col[0].tot_home_col },
            { field_name: "Coupon", tot_no: coupon[0].tot_coupon },
            { field_name: "My Earning", tot_no: lab[0].wallet }
        ];

        delete lab[0].wallet;
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', general_currency:general_setting[0], lab_detail:lab[0], data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// provide a, as, their, hir, her, that, this, there, those, etc... this type all details and exmaples



router.get("/list_category", async(req, res)=>{
    try {
        const category_list = await DataFind(`SELECT id, image, name FROM tbl_lab_category WHERE status = '1' ORDER BY id DESC`);
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Lab add successful', category_list });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============= Package ================ //

router.post("/package_list", async(req, res)=>{
    try {
        const {id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const package_list = await DataFind(`SELECT id, logo, title, package_type, package_name AS tot_packages, status FROM tbl_lab_package_list 
                                            WHERE lab_id = '${id}' AND status = '1' ORDER BY id DESC`);
        
        package_list.map(val => {
            val.tot_packages = val.tot_packages.length;
        });

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Lab add successful', package_list });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/package_detail", async(req, res)=>{
    try {
        const {id, pack_id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "pack_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const pd = await DataFind(`SELECT * FROM tbl_lab_package_list 
                                            WHERE id = '${pack_id}' AND lab_id = '${id}'`);

        if (pd == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Package not found!', package_detail: {} });

        pd[0].sample_type = typeof pd[0].sample_type == "string" ? JSON.parse(pd[0].sample_type) : pd[0].sample_type;
        pd[0].category_list = typeof pd[0].category_list == "string" ? JSON.parse(pd[0].category_list) : pd[0].category_list;
        pd[0].package_name = typeof pd[0].package_name == "string" ? JSON.parse(pd[0].package_name) : pd[0].package_name;
        pd[0].package_price = typeof pd[0].package_price == "string" ? JSON.parse(pd[0].package_price) : pd[0].package_price;

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Lab add successful', package_detail: pd[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



AllFunction.ImageUploadFolderCheck(`./public/uploads/lab_package`);
const storage3 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/lab_package");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const lab_package = multer({storage : storage3});

router.post("/add_package", async(req, res)=>{
    const { id, title, subtitle, description, home_extra_price, fasting_require, test_report_time, sample_type, category_list, package_type, status, packages, logo } = req.body;

    const missingField = await AllFunction.BodyDataCheck(["id", "title", "subtitle", "description", "home_extra_price", "fasting_require", "test_report_time", "sample_type", 
        "category_list", "package_type", "status", "packages", "logo"], req.body);
    if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

    let filename = ""
    try {
        let basepath = '';
        const signatures = [
            { prefix: 'iVBORw0KGgo', mime: 'image/png' },
            { prefix: '/9j/', mime: 'image/jpeg' },
            { prefix: 'R0lGODdh', mime: 'image/gif' },
            { prefix: 'R0lGODlh', mime: 'image/gif' },
            { prefix: 'Qk0', mime: 'image/bmp' },
            { prefix: 'SUkq', mime: 'image/tiff' },
            { prefix: 'AAABAA', mime: 'image/x-icon' },
            { prefix: 'JVBER', mime: 'application/pdf' },
            { prefix: 'UEsDB', mime: 'application/zip' },
            { prefix: 'UMFy', mime: 'application/x-rar-compressed' },
            { prefix: 'UklGR', mime: 'image/webp' },
            { prefix: 'RIFF', mime: 'image/webp' },
            { prefix: 'BM', mime: 'image/bmp' },
            { prefix: 'ACsp', mime: 'image/x-xbitmap' },
            { prefix: 'PD94bWwg', mime: 'image/svg+xml' },
        ];

        for (const { prefix, mime } of signatures) {
            if (logo.startsWith(prefix)) {
                basepath = mime
            }
        }
        
        const imgSrc = `data:${basepath};base64,${logo}`;

        const matches = imgSrc.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
        if (!matches) return res.status(400).json({ ResponseCode: 401, Result:false, message: 'Invalid base64' });

        const ext = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');

        filename = `${Date.now()}.${ext}`;
        const filePath = path.join(__dirname, '../public/uploads/lab_package', filename);

        await fs.writeFileSync(filePath, buffer);
    } catch (error) {
        console.log(error);
        return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Problem in image upload' });
    }

    try {
        let etitle = mysql.escape(title), esubtitle = mysql.escape(subtitle), edeacri = mysql.escape(description);
    
        const cl = category_list.map(val => Number(val));
        
        let pn = [], pnp = [];
        for (const tn of packages) {
            pn.push(tn.name); pnp.push(Number(tn.price));
        }
    
        if (await DataInsert(`tbl_lab_package_list`, `lab_id, logo, title, subtitle, description, home_extra_price, fasting_require, test_report_time, sample_type, category_list, 
            package_type, status, package_name, package_price`, 
            `'${id}', 'uploads/lab_package/${filename}', ${etitle}, ${esubtitle}, ${edeacri}, '${home_extra_price}', '${fasting_require}', '${test_report_time}', '${JSON.stringify(sample_type)}', 
            '${JSON.stringify(cl)}', '${package_type}', '${status}', '${JSON.stringify(pn)}', '${JSON.stringify(pnp)}'`, req.hostname, req.protocol) == -1) {
    
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Lab add successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.post("/edit_package", async(req, res)=>{
    const { id, pack_id, title, subtitle, description, home_extra_price, fasting_require, test_report_time, sample_type, category_list, package_type, status, packages, logo } = req.body;

    const missingField = await AllFunction.BodyDataCheck(["id", "pack_id", "title", "subtitle", "description", "home_extra_price", "fasting_require", "test_report_time", "sample_type", 
        "category_list", "package_type", "packages"], req.body);
    if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

    const pc = await DataFind(`SELECT id, logo FROM tbl_lab_package_list WHERE id = '${pack_id}' AND lab_id = '${id}' ORDER BY id DESC`);
    if (pc == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Package not found!' });
    
    let filename = ""
    if (logo != '') {
        try {
            let basepath = '';
            const signatures = [
                { prefix: 'iVBORw0KGgo', mime: 'image/png' },
                { prefix: '/9j/', mime: 'image/jpeg' },
                { prefix: 'R0lGODdh', mime: 'image/gif' },
                { prefix: 'R0lGODlh', mime: 'image/gif' },
                { prefix: 'Qk0', mime: 'image/bmp' },
                { prefix: 'SUkq', mime: 'image/tiff' },
                { prefix: 'AAABAA', mime: 'image/x-icon' },
                { prefix: 'JVBER', mime: 'application/pdf' },
                { prefix: 'UEsDB', mime: 'application/zip' },
                { prefix: 'UMFy', mime: 'application/x-rar-compressed' },
                { prefix: 'UklGR', mime: 'image/webp' },
                { prefix: 'RIFF', mime: 'image/webp' },
                { prefix: 'BM', mime: 'image/bmp' },
                { prefix: 'ACsp', mime: 'image/x-xbitmap' },
                { prefix: 'PD94bWwg', mime: 'image/svg+xml' },
            ];

            for (const { prefix, mime } of signatures) {
                if (logo.startsWith(prefix)) {
                    basepath = mime
                }
            }
          
            const imgSrc = `data:${basepath};base64,${logo}`;

            const matches = imgSrc.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
            if (!matches) return res.status(400).json({ ResponseCode: 401, Result:false, message: 'Invalid base64' });
    
            const ext = matches[1];
            const buffer = Buffer.from(matches[2], 'base64');
    
            filename = `${Date.now()}.${ext}`;
            const filePath = path.join(__dirname, '../public/uploads/lab_package', filename);
    
            await fs.writeFileSync(filePath, buffer);
            filename = `uploads/lab_package/${filename}`;
        } catch (error) {
            console.log(error);
            return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Problem in image upload' });
        }
    } else filename = pc[0].logo;

    try {
        let etitle = mysql.escape(title), esubtitle = mysql.escape(subtitle), edeacri = mysql.escape(description);
    
        const cl = category_list.map(val => Number(val));
        
        let pn = [], pnp = [];
        for (const tn of packages) {
            pn.push(tn.name); pnp.push(Number(tn.price));
        }
    
        if (await DataUpdate(`tbl_lab_package_list`, `logo = '${filename}', title = ${etitle}, subtitle = ${esubtitle}, description = ${edeacri}, home_extra_price = '${home_extra_price}', 
            fasting_require = '${fasting_require}', test_report_time = '${test_report_time}', sample_type = '${JSON.stringify(sample_type)}', category_list = '${JSON.stringify(cl)}', 
            package_type = '${package_type}', status = '${status}', package_name = '${JSON.stringify(pn)}', package_price = '${JSON.stringify(pnp)}'`, `id = '${pc[0].id}'`, 
            req.hostname, req.protocol) == -1) {
            
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Lab update successful' });
    } catch (error) {
        if (logo != '' && filename != '') AllFunction.DeleteImage(filename);
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/delete_package", async(req, res)=>{
    try {
        const { id, pack_id } = req.body;

        const missingField = await AllFunction.BodyDataCheck(["pack_id", "id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const pc = await DataFind(`SELECT id, logo FROM tbl_lab_package_list WHERE id = '${pack_id}' AND lab_id = '${id}' ORDER BY id DESC`);
        if (pc == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Package not found!' });
    
        await AllFunction.DeleteImage(pc[0].logo);
        if (await DataDelete(`tbl_lab_package_list`, `id = '${pc[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Package delete successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// ============= Coupon ================ //

router.post('/lab_coupon_list', async (req, res) => {
    try {
        const {id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const coupon_list = await DataFind(`SELECT * FROM tbl_lab_coupon WHERE lab_id = '${id}' ORDER BY id DESC`);
        
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

router.post('/add_lab_coupon', async (req, res) => {
    try {
        const {id, title, sub_title, code, start_date, end_date, min_amount, discount_amount} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "title", "sub_title", "code", "start_date", "end_date", "min_amount", "discount_amount"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        if (isValidDateFormat(start_date) === false || isValidDateFormat(end_date) === false) return res.status(200).json({ message: 'Invalid Date Format', status:false});
            
        if (new Date().toISOString().split("T")[0] <= start_date && start_date < end_date) {
            
            if (await DataInsert(`tbl_lab_coupon`, `lab_id, title, sub_title, code, start_date, end_date, min_amount, discount_amount`,
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

router.post('/edit_lab_coupon', async (req, res) => {
    try {
        const {id, coupon_id, title, sub_title, code, start_date, end_date, min_amount, discount_amount} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "title", "sub_title", "code", "start_date", "end_date", "min_amount", "discount_amount"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const coupon = await DataFind(`SELECT * FROM tbl_lab_coupon WHERE id = '${coupon_id}' AND lab_id = '${id}' ORDER BY id DESC`);
        if (coupon == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data not found!' });

        if (isValidDateFormat(start_date) === false || isValidDateFormat(end_date) === false) return res.status(200).json({ message: 'Invalid Date Format', status:false});
            
        if (new Date().toISOString().split("T")[0] <= start_date && start_date < end_date) {
                
            if (await DataUpdate(`tbl_lab_coupon`, `title = '${title}', sub_title = '${sub_title}', code = '${code}', start_date = '${start_date}', end_date = '${end_date}', 
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

router.post('/delete_lab_coupon', async (req, res) => {
    try {
        const {coupon_id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["coupon_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        if (await DataDelete(`tbl_lab_coupon`, `id = '${coupon_id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }
    
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Coupon delete successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// ============= Lab Collect User ================ //

router.post('/lab_collect_user_list', async (req, res) => {
    try {
        const {id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const user_list = await DataFind(`SELECT * FROM tbl_lab_home_collect_user WHERE lab_id = '${id}' ORDER BY id DESC`);

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data load successful', user_list });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/lab_collect_detail_check', async (req, res) => {
    try {
        const {email, country_code, phone} = req.body;

        let email_status = false, phone_status = false;
        if (email != '') {
            const es = await DataFind(`SELECT * FROM tbl_lab_home_collect_user WHERE email = '${email}' ORDER BY id DESC`);
            if (es == '') email_status = true;
            else email_status = false;
        }

        if (country_code != '' && phone != '') {
            const ps = await DataFind(`SELECT * FROM tbl_lab_home_collect_user WHERE country_code = '${country_code}' AND phone = '${phone}' ORDER BY id DESC`);
            if (ps == '') phone_status = true;
            else phone_status = false;
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'User detail check successful', email_status, phone_status });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/add_lab_collect', async (req, res) => {
    try {
        const {id, name, email, country_code, phone, status} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "name", "email", "country_code", "phone", "status"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const es = await DataFind(`SELECT * FROM tbl_lab_home_collect_user WHERE email = '${email}' ORDER BY id DESC`);
        const ps = await DataFind(`SELECT * FROM tbl_lab_home_collect_user WHERE country_code = '${country_code}' AND phone = '${phone}' ORDER BY id DESC`);
        
        if (ps != '' || es != '') return res.status(200).json({ ResponseCode: 401, Result:false, 
                                        message: `${es != '' ? 'Email' : ''} ${es != '' && es != '' ? 'And' : ''} ${es != '' ? 'Mobile number' : ''} already exist` });

        if (await DataInsert(`tbl_lab_home_collect_user`, `lab_id, name, email, country_code, phone, status`, `'${id}', ${mysql.escape(name)}, '${email}', '${country_code}', '${phone}', 
            '${status}'`, req.hostname, req.protocol) == -1) {

            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'User add successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/edit_lab_collect', async (req, res) => {
    try {
        const {id, lab_user_id, name, email, country_code, phone, status} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "lab_user_id", "name", "email", "country_code", "phone", "status"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const lab = await DataFind(`SELECT * FROM tbl_lab_home_collect_user WHERE id = '${lab_user_id}' AND lab_id = '${id}' ORDER BY id DESC`);
        if (lab == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'User Not found' });

        let es = '', ps = '';
        if (lab[0].email != email) es = await DataFind(`SELECT * FROM tbl_lab_home_collect_user WHERE email = '${email}' ORDER BY id DESC`);

        if (lab[0].country_code != country_code || lab[0].phone != phone) ps = await DataFind(`SELECT * FROM tbl_lab_home_collect_user WHERE country_code = '${country_code}' AND phone = '${phone}' ORDER BY id DESC`);
        
        if (ps != '' || es != '') return res.status(200).json({ ResponseCode: 401, Result:false, message: `${es != '' ? 'Email' : ''} Mobile number already exist` });
            
        if (await DataUpdate(`tbl_lab_home_collect_user`, `name = ${mysql.escape(name)}, email = '${email}', country_code = '${country_code}', phone = '${phone}', status = '${status}'`, 
            `id = '${lab[0].id}'`, req.hostname, req.protocol) == -1) {
        
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'User edit successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/delete_lab_collect', async (req, res) => {
    try {
        const {id, lab_user_id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "lab_user_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        if (await DataDelete(`tbl_lab_home_collect_user`, `id = '${lab_user_id}' AND lab_id = '${id}' `, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }
    
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'User delete successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





router.post('/lab_booking_list', async (req, res) => {
    try {
        const {id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const lb = await DataFind(`SELECT lb.id, lb.date, lb.tot_price, lb.status, COALESCE(cus.image, '') AS image, COALESCE(cus.name, '') AS name, 
                                    COALESCE(cus.country_code, '') AS country_code, COALESCE(cus.phone, '') AS phone,
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
                                    LEFT JOIN tbl_customer AS cus ON cus.id = lb.customer_id
                                    WHERE lab_id = '${id}';`);
        
        if (lb == '') return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data not found!', lab_pending_list: [], lab_complete_list: [] });
        
        const lbl = lb.map(val => ({
            ...val,
            date: new Date(val.date).toLocaleString('en-US', {
                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone 
            })
        }));

        const lab_pending_list = [...lbl].filter(val => ["Pending", "Accepted", "Assign Collector", "Ongoing", "In Progress"].includes(val.status_type)).reverse();
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
                                        lb.family_mem_id, lb.tot_price, lb.tot_package_price, lb.paid_amount, lb.coupon_id, lb.coupon_amount, lb.home_extra_price, 
                                        lb.site_commission, lb.payment_id, lb.wallet_amount, 0 AS online_amount, 0 AS cash_amount, COALESCE(pd.name, '') AS payment_name, 
                                        COALESCE(pd.image, '') AS payment_image, COALESCE(lhcu.name, '') AS home_c_user, COALESCE(lhcu.email, '') AS home_c_email, 
                                        COALESCE(lhcu.country_code, '') AS home_c_ccode, COALESCE(lhcu.phone, '') AS home_c_phone,
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
                                        LEFT JOIN tbl_payment_detail AS pd ON pd.id = lb.payment_id
                                        LEFT JOIN tbl_lab_home_collect_user AS lhcu ON lhcu.id = lb.home_collect_user_id
                                        LEFT JOIN tbl_lab_package_list pkg ON p.pid = pkg.id
                                        WHERE lb.id = '${lab_book_id}' AND lb.lab_id = '${id}'
                                        GROUP BY lb.id HAVING lb.id IS NOT NULL;`);
        
        if (appoint == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Apiintment not found!' });

        appoint[0].package_id = typeof appoint[0].package_id == 'string' ? JSON.parse(appoint[0].package_id) : appoint[0].package_id;
        appoint[0].family_mem_id = typeof appoint[0].family_mem_id == 'string' ? JSON.parse(appoint[0].family_mem_id) : appoint[0].family_mem_id;

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

        const date = new Date(appoint[0].date);
        const formattedDate = date.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
        appoint[0].date = formattedDate;

        if (appoint[0].payment_name != 'Cash') appoint[0].online_amount = Number((appoint[0].tot_price - appoint[0].wallet_amount).toFixed(2));
        else appoint[0].online_amount = 0;

        if (appoint[0].payment_name == 'Cash') appoint[0].cash_amount = Number((appoint[0].tot_price - appoint[0].paid_amount).toFixed(2));

        const customer = await DataFind(`SELECT lab.id, lab.image, lab.name, lab.email, lab.country_code, lab.phone
                                        FROM tbl_customer AS lab WHERE lab.id = '${appoint[0].customer_id}' AND lab.status = '1'`);
        
        if (customer == '') {
            req.flash('errors', `User not found!`);
            return res.redirect("back");    
        }

        const category = await DataFind(`SELECT id, image, name FROM tbl_lab_category WHERE id = '${appoint[0].category_id}' AND status = '1';`);
        
        let address = {};
        if (appoint[0].address != '') {
            const ad = await DataFind(`SELECT * FROM tbl_customer_address WHERE id = '${appoint[0].address}'`);
            address = ad[0];
        }

        delete appoint[0].pid_list; delete appoint[0].family_mem_id;

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Lab package book successful', appoint: appoint[0], customer: customer != '' ? customer[0] : {},
            category: category[0] || {}, address});
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

        const appont = await DataFind(`SELECT id, customer_id, lab_id, otp, status, status_list, paid_amount FROM tbl_lab_booking WHERE id = '${lab_book_id}' AND lab_id = '${id}'`);                    
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

router.post('/accept_lab_appointment', async (req, res) => {
    try {
        const {id, lab_book_id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "lab_book_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const appont = await DataFind(`SELECT id, customer_id, lab_id, otp, status, status_list, home_extra_price FROM tbl_lab_booking WHERE id = '${lab_book_id}' AND lab_id = '${id}'`);                    
        if (appont == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Appointment not found!' });
        appont[0].status_list = typeof appont[0].status_list == "string" ? JSON.parse(appont[0].status_list) : appont[0].status_list;

        if (appont[0].status != 1) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Appointment already accepted!' });

        let date = new Date()
        appont[0].status_list.unshift({ s:2, t: date.toISOString() });

        if (await DataUpdate(`tbl_lab_booking`, `status = '2', otp = '${await AllFunction.otpGenerate(4)}', status_list = '${JSON.stringify(appont[0].status_list)}'`, 
            `id = '${appont[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        let ms = `✅ Your lab appointment has been accepted. Appointment ID : # ${appont[0].id}`;
        sendOneNotification(ms, 'customer', appont[0].customer_id, 1);
        sendOneNotification(ms, 'customer', appont[0].customer_id, 2);
        if (await DataInsert(`tbl_notification`, `order_id, customer_id, service_user_id, date, mstatus, ostatus, notification`,
            `'${appont[0].id}', '${appont[0].customer_id}', '${appont[0].lab_id}', '${AllFunction.NotificationDate(date)}', '2', '2', '${ms}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Lab booking accepted.', status: 2, next_status_check: appont[0].home_extra_price <= 0 ? 4 : 3});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/lab_home_collect_user_list', async (req, res) => {
    try {
        const {id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const user_list = await DataFind(`SELECT * FROM tbl_lab_home_collect_user WHERE lab_id = '${id}' AND status = '1'`);                    
        if (user_list == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Appointment not found!' });

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Lab booking accepted.', user_list}); 
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/appoint_home_collect_user', async (req, res) => {
    try {
        const {id, lab_book_id, home_collector_id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "lab_book_id", "home_collector_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const appont = await DataFind(`SELECT id, customer_id, lab_id, status, status_list, home_extra_price FROM tbl_lab_booking WHERE id = '${lab_book_id}' AND lab_id = '${id}'`); 
        if (appont == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Appointment not found!' });
        
        if (appont[0].status != 2) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Appointment already ongoing!' });
        if (appont[0].home_extra_price <= 0) return res.status(200).json({ ResponseCode: 200, Result:false, message: 'This appointment is not home going.', status: 0, next_status_check: 0});

        let date = new Date()
        appont[0].status_list.unshift({ s:3, t: date.toISOString() });

        if (await DataUpdate(`tbl_lab_booking`, `status = '3', status_list = '${JSON.stringify(appont[0].status_list)}', home_collect_user_id = '${home_collector_id}'`, 
            `id = '${appont[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        const hcollect = await DataFind(`SELECT * FROM tbl_lab_home_collect_user WHERE id = '${home_collector_id}' AND status = '1'`);       

        let ms = `🧑‍🔬 A sample collector has been assigned${hcollect != "" ? ' :' + hcollect[0].name : '' }. They will contact you shortly. Appointment ID : # ${appont[0].id}`;
        sendOneNotification(ms, 'customer', appont[0].customer_id, 1);
        sendOneNotification(ms, 'customer', appont[0].customer_id, 2);
        if (await DataInsert(`tbl_notification`, `order_id, customer_id, service_user_id, date, mstatus, ostatus, notification`,
            `'${appont[0].id}', '${appont[0].customer_id}', '${appont[0].lab_id}', '${AllFunction.NotificationDate(date)}', '2', '3', '${ms}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }
        
        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Home collect assign successful.', status: 3, next_status_check: 4});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/home_collect_appoint_ongoing', async (req, res) => {
    try {
        const {id, lab_book_id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "lab_book_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const appont = await DataFind(`SELECT id, customer_id, lab_id, status, status_list, home_extra_price FROM tbl_lab_booking WHERE id = '${lab_book_id}' AND lab_id = '${id}'`); 
        if (appont == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Appointment not found!' });
        
        if (appont[0].home_extra_price > 0) {
            if (appont[0].status != 3) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Appointment not assign home collect user!' });
        } else {
            if (appont[0].status != 2) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Appointment not accepted!' });
        }

        let date = new Date();
        appont[0].status_list.unshift({ s:4, t: date.toISOString() });

        if (await DataUpdate(`tbl_lab_booking`, `status = '4', status_list = '${JSON.stringify(appont[0].status_list)}'`, `id = '${appont[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        let ms = `🔄 Your lab appointment is currently in progress. Appointment ID : # ${appont[0].id}`;
        sendOneNotification(ms, 'customer', appont[0].customer_id, 1);
        sendOneNotification(ms, 'customer', appont[0].customer_id, 2);
        if (await DataInsert(`tbl_notification`, `order_id, customer_id, service_user_id, date, mstatus, ostatus, notification`,
            `'${appont[0].id}', '${appont[0].customer_id}', '${appont[0].lab_id}', '${AllFunction.NotificationDate(date)}', '2', '4', '${ms}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'appointment ongoing successful.', status: 4, next_status_check: 5});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/appoint_set_in_progress', async (req, res) => {
    try {
        const {id, lab_book_id, otp} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "lab_book_id", "otp"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const appont = await DataFind(`SELECT id,customer_id, lab_id, status, otp, status_list FROM tbl_lab_booking WHERE id = '${lab_book_id}' AND lab_id = '${id}'`); 
        if (appont == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Appointment not found!' });
        
        if (appont[0].status != 4) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'This Aappointment is not ongoing!' });
        if (appont[0].otp != otp) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'OTP not match!' });

        let date = new Date();
        appont[0].status_list.unshift({ s: 5, t: date.toISOString() });

        if (await DataUpdate(`tbl_lab_booking`, `status = '5', status_list = '${JSON.stringify(appont[0].status_list)}', otp = ''`, `id = '${appont[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        let ms = `🧪 Your appointment is now in progress. Appointment ID : # ${appont[0].id}`;
        sendOneNotification(ms, 'customer', appont[0].customer_id, 1);
        sendOneNotification(ms, 'customer', appont[0].customer_id, 2);
        if (await DataInsert(`tbl_notification`, `order_id, customer_id, service_user_id, date, mstatus, ostatus, notification`,
            `'${appont[0].id}', '${appont[0].customer_id}', '${appont[0].lab_id}', '${AllFunction.NotificationDate(date)}', '2', '5', '${ms}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Appointment set in progress.', status: 5, next_status_check: 6});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



AllFunction.ImageUploadFolderCheck(`./public/uploads/lab_reports`);
const storage4 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/lab_reports");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const lab_reports = multer({storage : storage4});

async function deleteAllReportImage(images) {
    for (const dimg of images) {
        await AllFunction.DeleteImage(dimg);
    }
    return true;
}

router.post('/upload_lab_report', lab_reports.array("report"), async (req, res) => {
    try {
        const {id, lab_book_id, pack_id, fm_id, comment} = req.body;

        if (req.files == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'please upload Report!' });
        let images = req.files || [], totimg = [];
        for (const img of images) {
            totimg.push(`uploads/lab_reports/${img.filename}`);
        }

        const missingField = await AllFunction.BodyDataCheck(["id", "lab_book_id", "pack_id", "fm_id"], req.body);
        if (missingField.status == false) {
            if (totimg.length > 0) await deleteAllReportImage(totimg);
            return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });
        }

        const appont = await DataFind(`SELECT id, status, package_id FROM tbl_lab_booking WHERE id = '${lab_book_id}' AND lab_id = '${id}'`); 
        if (appont == '') {
            if (totimg.length > 0) await deleteAllReportImage(totimg);
            return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Appointment not found!' });
        }
        
        if (appont[0].status != 5) {
            if (totimg.length > 0) await deleteAllReportImage(totimg);
            return res.status(200).json({ ResponseCode: 401, Result:false, message: 'This Aappointment is not ongoing!' });
        }
        
        appont[0].package_id = typeof appont[0].package_id == "string" ? JSON.parse(appont[0].package_id) : appont[0].package_id; 

        const findfid = appont[0].package_id.find(p => p.pid == pack_id);
        
        if (findfid) {
            const fid = findfid.f.find(v => v.id == fm_id);
            if (fid) { 
                if (fid.r.length > 0) await deleteAllReportImage(fid.r);
                fid.r = totimg; fid.c = comment; fid.d = new Date().toISOString();
            } else {
                await deleteAllReportImage(totimg);
                return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Family Member Not Found!' });
            }

        } else {
            await deleteAllReportImage(totimg);
            return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Package Not Found!' });
        }

        if (await DataUpdate(`tbl_lab_booking`, `status = '5', package_id = '${JSON.stringify(appont[0].package_id)}'`, `id = '${appont[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Appointment set in progress.', status: 5, next_status_check: 6});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/appoint_complete', async (req, res) => {
    try {
        const {id, lab_book_id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "lab_book_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const appont = await DataFind(`SELECT lb.id, lb.customer_id, lb.lab_id, lb.status, lb.status_list, lb.tot_price, lb.paid_amount, lb.site_commission, lb.wallet_amount, lb.payment_id,
                                        COALESCE(ll.wallet, 0) AS lab_wallet, COALESCE(ll.cash_amount, 0) AS lab_cash_amount, COALESCE(ll.tot_payout, 0) AS lab_tot_payout,
                                        COALESCE(cus.pending_ref, '') AS pending_ref, COALESCE(cus.tot_balance, '') AS tot_balance, 0 AS payout_amount, 0 AS cash_amount, 0 AS pay_cash
                                        FROM tbl_lab_booking AS lb
                                        LEFT JOIN tbl_lab_list AS ll ON ll.id = lb.lab_id
                                        LEFT JOIN tbl_customer AS cus ON cus.id = lb.customer_id
                                        WHERE lb.id = '${lab_book_id}' AND lb.lab_id = '${id}'`);
        if (appont == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Appointment not found!' });
        
        if (appont[0].status != 5) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'This Aappointment is In progress!' });

        if (appont[0].payment_id != '16') appont[0].payout_amount = Number((appont[0].tot_price - appont[0].site_commission).toFixed(2));
        else {
            appont[0].pay_cash = Math.max(0, Number((appont[0].site_commission - appont[0].wallet_amount).toFixed(2)));
            appont[0].payout_amount = Math.max(0, Number((appont[0].wallet_amount - appont[0].site_commission).toFixed(2)));
            appont[0].paid_amount = appont[0].tot_price;
        }
        
        let date = new Date();
        if (appont[0].pay_cash > 0) {
            if (await DataInsert(`tbl_lab_cash_adjust`, `appointment_id, lab_id, status, proof_image, amount, date, payment_type, c_status`, 
                `'${appont[0].id}', '${appont[0].lab_id}', '1', '', '${appont[0].pay_cash}', '${date.toISOString()}', '', ''`, req.hostname, req.protocol) == -1) {
        
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }
            
            appont[0].lab_cash_amount = Number((appont[0].lab_cash_amount + appont[0].pay_cash).toFixed(2));
        }
        
        if (appont[0].payout_amount > 0) {

            if (await DataInsert(`tbl_lab_payout_adjust`, `appointment_id, lab_id, amount, date, status, p_status, image, p_type, upi_id, paypal_id, bank_no, bank_ifsc, bank_type`,
                `'${appont[0].id}', '${appont[0].lab_id}', '${appont[0].payout_amount}', '${date.toISOString()}', '1', '', '', '', '', '', '', '', ''`, req.hostname, req.protocol) == -1) {
        
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }
            
            appont[0].lab_tot_payout = Number((appont[0].lab_tot_payout + appont[0].payout_amount).toFixed(2));
        }

        appont[0].lab_wallet = Number(( appont[0].lab_wallet + (appont[0].tot_price - appont[0].site_commission)).toFixed(2));

        if (await DataUpdate(`tbl_lab_list`, `wallet = '${appont[0].lab_wallet}', cash_amount = '${appont[0].lab_cash_amount}', tot_payout = '${appont[0].lab_tot_payout}'`,
            `id = '${appont[0].lab_id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }


        appont[0].status_list.unshift({ s: 6, t: date.toISOString() });

        if (await DataUpdate(`tbl_lab_booking`, `status = '6', status_list = '${JSON.stringify(appont[0].status_list)}', paid_amount = '${appont[0].tot_price}'`, 
            `id = '${appont[0].id}'`, req.hostname, req.protocol) == -1) {
            
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        if (appont[0].pending_ref != '') {
            await AllFunction.SetReferralAmount(appont[0].pending_ref, appont[0].customer_id, appont[0].tot_balance);
        }

        let ms = `✅ Sample collection is complete. You'll receive your lab report soon. Appointment ID : # ${appont[0].id}`;
        sendOneNotification(ms, 'customer', appont[0].customer_id, 1);
        sendOneNotification(ms, 'customer', appont[0].customer_id, 2);
        if (await DataInsert(`tbl_notification`, `order_id, customer_id, service_user_id, date, mstatus, ostatus, notification`,
            `'${appont[0].id}', '${appont[0].customer_id}', '${appont[0].lab_id}', '${AllFunction.NotificationDate(date)}', '2', '6', '${ms}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Appointment complete successful.', status: 6, next_status_check: 0});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





router.post('/lab_total_earning', async (req, res) => {
    try {
        const {id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const lab = await DataFind(`SELECT dl.wallet, dl.tot_payout, COALESCE(gs.lab_min_withdraw, "0") AS lab_min_withdraw
                                        FROM tbl_lab_list AS dl
                                        LEFT JOIN tbl_general_settings AS gs ON 1 = 1
                                        WHERE dl.id = '${id}'`);
        if(lab == '') return res.status(200).json({ ResponseCode: 200, Result: true, message: 'User not found!', lab_amount: { "wallet": 0, "tot_payout": 0, "lab_min_withdraw": '0' }, appointment_list: [] });

        const app = await DataFind(`SELECT bookap.id, (bookap.tot_price - bookap.site_commission) AS tot_earning, bookap.tot_price, bookap.site_commission, bookap.wallet_amount, 
                                    0 AS online_amount, 0 AS cash_amount, bookap.book_date, bookap.book_time, 
                                    CASE WHEN bookap.status = "6" THEN 'completed' WHEN bookap.status = "7" THEN 'canceled' END AS status_type,
                                    COALESCE(cus.name, '') AS cus_name, COALESCE(pd.name, '') AS p_name, bookap.wallet_amount AS wallet_status
                                    FROM tbl_lab_booking AS bookap
                                    LEFT JOIN tbl_customer AS cus ON cus.id = bookap.customer_id
                                    LEFT JOIN tbl_payment_detail AS pd ON pd.id = bookap.payment_id
                                    WHERE bookap.lab_id = '${id}' AND bookap.status IN (6,7) ORDER BY bookap.id DESC;`);
        
        if(app == '') return res.status(200).json({ ResponseCode: 200, Result: true, message: 'Data not found!', lab_amount: lab[0], appointment_list: [] });
        
        const all_data = [];
        app.forEach(item => {
            item.date = new Date(`${item.book_date.split("-").reverse()} ${item.book_time}`).toISOString().split("T")[0];
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

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Total appointment earning load successful', lab_amount: lab[0], appointment_list: all_data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.post('/lab_total_payout', async (req, res) => {
    try {
        const {id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const lab = await DataFind(`SELECT tot_payout, success_payout FROM tbl_lab_list WHERE id = '${id}'`);
        if(lab == '') return res.status(200).json({ ResponseCode: 200, Result:true, message: 'User not found!', lab_amount: { "tot_payout": 0, "success_payout": 0 }, payout_list: [] });

        const app = await DataFind(`SELECT id, appointment_id, lab_id, amount, date, status, p_status, image, p_type
                                    FROM tbl_lab_payout_adjust WHERE lab_id = '${id}' ORDER BY id DESC`);
                                    
        if(app == '') return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data not found!', lab_amount: lab[0], payout_list: [] });

        app.map(val => {
            val.date = new Date(val.date).toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })
            delete val.appointment_time;
        });

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Total Payout load successful', lab_amount: lab[0], payout_list: app });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/lab_payout_withdraw', async (req, res) => {
    try {
        const { id, Withdraw_amount, payment_type, upi_id, paypal_id, bank_no, bank_ifsc, bank_type } = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["id", "Withdraw_amount", "payment_type"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const doctor = await DataFind(`SELECT id, tot_payout, success_payout FROM tbl_lab_list WHERE id = '${id}'`);
        if (doctor == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'User Not Found!'});

        const general_setting = await DataFind(`SELECT lab_min_withdraw FROM tbl_general_settings`);
        if (general_setting == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data Not Found!'});
        
        if (doctor[0].tot_payout >= general_setting[0].lab_min_withdraw) {
            const date = new Date().toISOString();
            
            if (parseFloat(Withdraw_amount) >= parseFloat(general_setting[0].lab_min_withdraw) && parseFloat(Withdraw_amount) <= doctor[0].tot_payout) {
                console.log(doctor[0].tot_payout);
                let check = 0, wid;
                if (payment_type == "UPI") {
                    const missingField = await AllFunction.BodyDataCheck(["upi_id"], req.body);
                    if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

                    check = 1;

                    wid = await DataInsert(`tbl_lab_payout_adjust`, `appointment_id, lab_id, amount, date, status, p_status, image, p_type, upi_id, paypal_id, bank_no, bank_ifsc, bank_type`,
                        `'', '${id}', '${Withdraw_amount}', '${date}', '2', '0', '', '1', '${upi_id}', '', '', '', ''`, req.hostname, req.protocol);
                    
                } else if (payment_type == "Paypal") {
                    const missingField = await AllFunction.BodyDataCheck(["paypal_id"], req.body);
                    if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

                    check = 1;

                    wid = await DataInsert(`tbl_lab_payout_adjust`, `appointment_id, lab_id, amount, date, status, p_status, image, p_type, upi_id, paypal_id, bank_no, bank_ifsc, bank_type`,
                        `'', '${id}', '${Withdraw_amount}', '${date}', '2', '0', '', '2', '', '${paypal_id}', '', '', ''`, req.hostname, req.protocol);
                    
                } else if (payment_type == "BANK Transfer") {
                    const missingField = await AllFunction.BodyDataCheck(["bank_no", "bank_ifsc", "bank_type"], req.body);
                    if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

                    check = 1;

                    wid = await DataInsert(`tbl_lab_payout_adjust`, `appointment_id, lab_id, amount, date, status, p_status, image, p_type, upi_id, paypal_id, bank_no, bank_ifsc, bank_type`,
                        `'', '${id}', '${Withdraw_amount}', '${date}', '2', '0', '', '3', '', '', '${bank_no}', '${bank_ifsc}', '${bank_type}'`, req.hostname, req.protocol);

                }
                if (wid == -1) return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });

                if (check == "1") {
                    let total = parseFloat((parseFloat(doctor[0].tot_payout) - parseFloat(Withdraw_amount)).toFixed(2));
                    let success_payout = parseFloat((parseFloat(doctor[0].success_payout) + parseFloat(Withdraw_amount)).toFixed(2));

                    if (await DataUpdate(`tbl_lab_list`, `tot_payout = '${total}', success_payout = '${success_payout}'`, `id = '${doctor[0].id}'`, req.hostname, req.protocol) == -1) {
                        return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
                    }
                }

                return res.status(200).json({ ResponseCode: 200, Result:true, message: "Wallet Withdraw Request Add Successfully" });
            }
            return res.status(200).json({ ResponseCode: 401, Result:false, message: `Minimum Withdrawn Amount ${general_setting[0].lab_min_withdraw}` });
        } else {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: `Minimum Withdrawn Amount ${general_setting[0].lab_min_withdraw}` });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/lab_total_cash_management', async (req, res) => {
    try {
        const {id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const lab = await DataFind(`SELECT cash_amount, success_cash FROM tbl_lab_list WHERE id = '${id}'`);
        if(lab == '') return res.status(200).json({ ResponseCode: 200, Result:true, message: 'User not found!', cash: { "cash_amount": 0, "success_cash": 0 }, cash_list: [] });

        const app = await DataFind(`SELECT * FROM tbl_lab_cash_adjust WHERE lab_id = '${id}' AND status = '2' ORDER BY id DESC`);
                                        
        if(app == '') return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Data not found!', cash: lab[0], cash_list: [] });
        
        const ad = await AllFunction.DateConvertDay(app);

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Total cash data load successful', cash: lab[0], cash_list: ad });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.post('/lab_cash_management_history', async (req, res) => {
    try {
        const {id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const doctor = await DataFind(`SELECT cash_amount, success_cash FROM tbl_lab_list WHERE id = '${id}'`);
        if(doctor == '') return res.status(200).json({ ResponseCode: 200, Result:true, message: 'User not found!', cash: { "cash_amount": 0, "success_cash": 0 }, cash_list: [] });

        const app = await DataFind(`SELECT bookap.id, (bookap.tot_price - bookap.site_commission) AS tot_earning, bookap.tot_price, bookap.site_commission, bookap.wallet_amount, 
                                    0 AS online_amount, 0 AS cash_amount, dca.amount AS add_cash, bookap.book_date, bookap.book_time,
                                    COALESCE(cus.name, '') AS cus_name, COALESCE(pd.name, '') AS p_name, bookap.wallet_amount AS wallet_status
                                    FROM tbl_lab_cash_adjust AS dca
                                    JOIN tbl_lab_booking AS bookap ON bookap.id = dca.appointment_id
                                    LEFT JOIN tbl_customer AS cus ON cus.id = bookap.customer_id
                                    LEFT JOIN tbl_payment_detail AS pd ON pd.id = bookap.payment_id
                                    WHERE dca.lab_id = '${id}' ORDER BY dca.id DESC;`);
        
        if(app == '') return res.status(200).json({ ResponseCode: 200, Result: true, message: 'Data not found!', cash: doctor[0], cash_list: [] });
        
        const all_data = [];
        app.forEach(item => {
            item.date = new Date(`${item.book_date.split("-").reverse()} ${item.book_time}`).toISOString().split("T")[0];
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

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Cash management history load successful', cash: doctor[0], cash_list: all_data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



AllFunction.ImageUploadFolderCheck(`./public/uploads/lab_cash_proof`);
const storage5 = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/lab_cash_proof");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const cash_proof = multer({storage : storage5});

router.post('/lab_cash_withdraw', cash_proof.single("cash_proof_img"), async (req, res) => {
    try {
        const {id, cash_amount, payment_type} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["id", "cash_amount", "payment_type"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });
        if (!req.file) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Please upload Image!' });

        const lab = await DataFind(`SELECT id, cash_amount, success_cash FROM tbl_lab_list WHERE id = '${id}'`);
        if(lab == '') {
            if (req.file) await AllFunction.DeleteImage("uploads/lab_cash_proof/" + req.file.filename)
            return res.status(200).json({ ResponseCode: 401, Result:false, message: 'User not found!' });
        }

        if (lab[0].cash_amount >= cash_amount) {
            const imageUrl = req.file ? "uploads/lab_cash_proof/" + req.file.filename : null;

            if (await DataInsert(`tbl_lab_cash_adjust`, `appointment_id, lab_id, status, proof_image, amount, date, payment_type, c_status`, 
                `'', '${id}', '2', '${imageUrl}', '${cash_amount}', '${new Date().toISOString()}', '${payment_type}', '1'`, req.hostname, req.protocol) == -1) {
        
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }

            let cash_total = parseFloat((parseFloat(lab[0].cash_amount) - parseFloat(cash_amount)).toFixed(2));
            let success_cash = parseFloat((parseFloat(lab[0].success_cash) + parseFloat(cash_amount)).toFixed(2));
            
            if (await DataUpdate(`tbl_lab_list`, `cash_amount = '${cash_total}', success_cash = '${success_cash}'`, `id = '${lab[0].id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }
            return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Cash withdraw successful' });
        }

        if (req.file) await AllFunction.DeleteImage("uploads/lab_cash_proof/" + req.file.filename)
        return res.status(200).json({ ResponseCode: 200, Result:false, message: `Your available cash balance ${lab[0].cash_amount}` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/delete_lab_account', async (req, res) => {
    try {
        const { id } = req.body;
        const missingField = await AllFunction.BodyDataCheck(["id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const lab = await DataFind(`SELECT * FROM tbl_lab_list WHERE id = '${id}'`);
        if (lab == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'User not found!' });
        
        if (await DataUpdate(`tbl_lab_list`, `status = '0'`, `id = '${lab[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Account Deleted Successfully'});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





module.exports = router;
/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */


const express = require("express");
const router = express.Router();
const multer  = require('multer');
const mysql = require('mysql');
const AllFunction = require("../route_function/function");
const sendOneNotification = require("../middleware/send");
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/database_query");



// ============= Sub category list ================ //

router.get('/category_list', async(req, res)=>{
    try {
        const category_list = await DataFind(`SELECT id, image, name FROM tbl_store_category WHERE status = '1' ORDER BY id DESC;`);

        return res.status(200).json({ResponseCode: 200, Result:true, message: 'Data Load successful', category_list });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// ============= Sub category list ================ //

router.post('/store_list', async(req, res)=>{
    try {
        const {category_id, lat, lon} = req.body;
        
        const missingField = await AllFunction.BodyDataCheck(["category_id", "lat", "lon"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const store_list = await DataFind(`SELECT COALESCE(dl.id, 0) AS id, COALESCE(dsd.image, '') AS image, COALESCE(dsd.name, '') AS name,
                                                COALESCE(dsd.address, '') AS address, COALESCE(dl.latitude, 0) AS latitude, COALESCE(dl.longitude, 0) AS longitude
                                                FROM tbl_store_subcategory AS ssc
                                                JOIN tbl_doctor_list AS dl ON dl.id = ssc.doctor_id
                                                JOIN tbl_zone AS zon ON ST_Contains(
                                                    zon.lat_lon_polygon,
                                                    ST_SRID(ST_GeomFromText(CONCAT('POINT(', ${Number(lon)}, ' ', ${Number(lat)}, ')')), 4326)
                                                )
                                                JOIN tbl_zone AS dzon ON ST_Contains(
                                                    dzon.lat_lon_polygon,
                                                    ST_SRID(ST_GeomFromText(CONCAT('POINT(', dl.longitude, ' ', dl.latitude, ')')), 4326)
                                                )
                                                JOIN tbl_doctor_store_detail AS dsd ON dsd.doctor_id = dl.id
                                                WHERE ssc.category_id = '${category_id}' AND zon.status = '1' AND dzon.status = '1' AND dzon.id = zon.id
                                                GROUP BY ssc.doctor_id, dsd.image, dsd.name, dsd.address`);

        
        if (store_list == '') return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Sub category not found!', store_list:[] });
        
        res.status(200).json({ResponseCode: 200, Result:true, message: 'Data Load successful', store_list });   
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// ============= Sub category list ================ //

router.post('/sub_category_list', async(req, res)=>{
    try {
        const {uid, doctor_id, category_id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["doctor_id", "category_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const banner_list = await DataFind(`SELECT images FROM tbl_doctor_subcategory_banner WHERE doctor_id = '${doctor_id}'`);
        banner_list.map(val => {
            val.images = val.images.split("&!!");
        });

        const sub_category = await DataFind(`SELECT sub.id, COALESCE(ser.name, '') AS category_name, sub.name, sub.image
                                            FROM tbl_store_subcategory AS sub
                                            LEFT JOIN tbl_store_category AS ser ON sub.doctor_id = ser.id
                                            WHERE sub.doctor_id = '${doctor_id}' AND sub.category_id = '${category_id}' AND sub.status = '1'`);

        res.status(200).json({ResponseCode: 200, Result:true, message: 'Data Load successful', banner_list: banner_list != '' ? banner_list[0].images : [], sub_category });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// ============= Subcategory product list ================ //

router.post('/sub_product_list', async(req, res)=>{
    try {
        const {uid, doctor_id, category_id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["doctor_id", "category_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const product_list = await DataFind(`SELECT id, product_image, product_name, price_detail FROM tbl_doctor_store_product
                                            WHERE doctor_id = '${doctor_id}' AND sub_category_id = '${category_id}' AND status = '1' ORDER BY id DESC`);
        
        // if (product_list == "") return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Product not found!', product_list: [] });
        
        const cl = await DataFind(`SELECT id, product_id_list, 
                                    (
                                        SELECT SUM(CAST(JSON_EXTRACT(p, '$.qty') AS UNSIGNED))
                                        FROM JSON_TABLE(product_id_list, '$[*]' COLUMNS (p JSON PATH '$')) AS list,
                                        JSON_TABLE(list.p, '$' COLUMNS (qty INT PATH '$.qty')) AS q
                                    ) AS tot_qty 
                                    FROM tbl_doctor_product_cart 
                                    WHERE customer_id = '${uid}' AND doctor_id = '${doctor_id}'`);
        
        const mcd = cl != '' ? cl[0].product_id_list : [];
        product_list.map(pval => {
            pval.product_image = pval.product_image.split("&!!")[0];

            pval.price_detail.map(pv => {
                const pcd = mcd.find(val => (val.id == pval.id && val.ptype == pv.title));

                let qty = pcd ? pcd.qty : 0;
                pv.cart_qty = qty;
            });
        });

        res.status(200).json({ResponseCode: 200, Result:true, message: 'Data Load successful', tot_cart_qty: cl != '' ? Number(cl[0].tot_qty) : 0, product_list });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});






// ============= Product search ================ //

router.post('/product_search', async(req, res)=>{
    try {
        const {uid, doctor_id, search_field} = req.body;
        const missingField = await AllFunction.BodyDataCheck(["uid", "doctor_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const product_list = await DataFind(`SELECT id, product_image, product_name, price_detail FROM tbl_doctor_store_product
                                            WHERE product_name LIKE '%${search_field}%' AND doctor_id = '${doctor_id}' AND status = '1' ORDER BY id DESC;`);
        
        if (product_list == "") return res.status(200).json({ ResponseCode: 200, Result: true, message: 'Product not found!', product_list });
        
        const cl = await DataFind(`SELECT id, product_id_list FROM tbl_doctor_product_cart WHERE customer_id = '${uid}' AND doctor_id = '${doctor_id}'`);
        const mcd = cl != '' ? cl[0].product_id_list : [];

        product_list.map(pval => {
            pval.product_image = pval.product_image.split("&!!")[0];

            pval.price_detail.map(pv => {
                const pcd = mcd.find(val => (val.id == pval.id && val.ptype == pv.title));
                pv.cart_qty = pcd ? pcd.qty : 0
            });
        });

        res.status(200).json({ResponseCode: 200, Result: true, message: 'Data Load successful', product_list });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// ============= Subcategory product detail ================ //

router.post('/product_detail', async(req, res)=>{
    try {
        const {uid, doctor_id, prod_id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["uid", "doctor_id", "prod_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });
        
        const product = await DataFind(`SELECT dpro.id, dpro.product_image, dpro.product_name, dpro.description, dpro.price_detail, dpro.status, dpro.pro_type, dpro.prescription_require,
                                        COALESCE(ser.name, '') AS service_name, COALESCE(subs.name, '') AS subser_name 

                                        -- COALESCE(SUM(jt.qty), '0') AS cart_qty, COALESCE(ANY_VALUE(jt.price), 0) AS cart_price, COALESCE(ANY_VALUE(jt.ptype), '') AS cart_ptype

                                        FROM tbl_doctor_store_product AS dpro
                                        LEFT JOIN tbl_store_subcategory AS subs ON dpro.sub_category_id = subs.id
                                        LEFT JOIN tbl_store_category AS ser ON subs.category_id = ser.id

                                        LEFT JOIN tbl_doctor_product_cart AS cart ON JSON_CONTAINS(JSON_EXTRACT(cart.product_id_list, '$[*].id'), '${prod_id}') 
                                        AND cart.customer_id = '${uid}' AND cart.doctor_id = '${doctor_id}'

                                        LEFT JOIN JSON_TABLE(cart.product_id_list, "$[*]" COLUMNS (id INT PATH "$.id", qty INT PATH "$.qty", price INT PATH "$.price", ptype LONGTEXT PATH "$.ptype")) AS jt 
                                        ON jt.id = '${prod_id}' AND cart.customer_id = '${uid}' AND cart.doctor_id = '${doctor_id}'

                                        WHERE dpro.id = '${prod_id}'
                                        GROUP BY dpro.id ORDER BY dpro.id DESC;`);

        if (product == "") return res.status(200).json({ ResponseCode: 200, Result:true, message: 'Product not found!', product: {} });
        
        const cl = await DataFind(`SELECT id, product_id_list,
                                    (
                                        SELECT SUM(CAST(JSON_EXTRACT(p, '$.qty') AS UNSIGNED))
                                        FROM JSON_TABLE(product_id_list, '$[*]' COLUMNS (p JSON PATH '$')) AS list,
                                        JSON_TABLE(list.p, '$' COLUMNS (qty INT PATH '$.qty')) AS q
                                    ) AS tot_qty                         
                                    FROM tbl_doctor_product_cart 
                                    WHERE customer_id = '${uid}' AND doctor_id = '${doctor_id}'`);

        const mcd = cl != '' ? cl[0].product_id_list : [];
        product[0].product_image = product[0].product_image.split("&!!");

        product[0].price_detail.map(pv => {
            const pcd = mcd.find(val => (val.id == product[0].id && val.ptype == pv.title));

            let qty = pcd ? pcd.qty : 0;
            pv.cart_qty = qty;
        });

        res.status(200).json({ResponseCode: 200, Result:true, message: 'Data Load successful', tot_cart_qty: cl != '' ? Number(cl[0].tot_qty) : 0, product:product[0] });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// ============= Add cart ================ //

router.post('/cart_detail', async(req, res)=>{
    try {
        const {uid, doctor_id, prod_id, pro_price, pro_ptype, pro_qty, pro_qty_type, mode} = req.body;
        
        const missingField = await AllFunction.BodyNumberDataCheck(["uid", "doctor_id", "mode"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        let nnmbid = 0, pqty = 0, pqt = 0, pp = 0; undefined
        if (mode != 0) {
            
            const missingField = await AllFunction.BodyNumberDataCheck(["prod_id"], req.body);
            if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

            if (typeof prod_id != 'number') nnmbid = Number(prod_id);
            else nnmbid = prod_id;

            if (!isNaN(nnmbid) == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });
        }

        if (mode == 1) {
            
            const missingField = await AllFunction.BodyNumberDataCheck(["pro_qty", "pro_qty_type"], req.body);
            if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

            if (typeof pro_qty != 'number') pqty = Number(pro_qty);
            else pqty = pro_qty;
            
            if (typeof pro_qty_type != 'number') pqt = Number(pro_qty_type);
            else pqt = pro_qty_type;

            if (!isNaN(pqty) == false || !isNaN(pqt) == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Something went wrong' });

            const pcheck = await DataFind(`SELECT id FROM tbl_doctor_store_product WHERE id = '${nnmbid}' AND status = '1'`);
            if (pcheck == '') return res.status(200).json({ResponseCode: 200, Result:true, message: 'Product not found!', tot_price: 0, cart_list: [] });
        }

        const pcart = await DataFind(`SELECT * FROM tbl_doctor_product_cart WHERE customer_id = '${uid}' AND doctor_id = '${doctor_id}'`);
        if (mode == 0 || mode == 2) {
            if (pcart == '') return res.status(200).json({ResponseCode: 200, Result:true, message: 'Cart not found!', tot_price: 0, cart_list: [] });
            if (typeof pcart[0].product_id_list == "string") pcart[0].product_id_list = JSON.parse(pcart[0].product_id_list);
        }
        
        let idlist = '', nidlist = [], plist = [], nidata = [], tot_price = 0, status = 0;
        
        let pcd = pcart != "" ? pcart[0].product_id_list : [];
        
        if (mode == "1" || mode == "2") {

            if (pqt == 1) pqty++;
            else if (pqt == 2) pqty--;

            if (pcart != "") {
                if (mode == "1") {
                    let plspl = pcd.find(val => val.id == nnmbid && val.ptype == pro_ptype);
                    
                    if (plspl) {
                        if (pqty > 0) {
                            plspl.id = nnmbid; plspl.qty = pqty; plspl.ptype = pro_ptype;
                        } else {
                            pcd = pcd.filter(function(val) {
                                return !(val.id == nnmbid && val.ptype == pro_ptype);
                            });
                        }
                    } else {
                        if (mode == "1" && pqty > 0) pcd.unshift({id: nnmbid, qty: pqty, ptype: pro_ptype});
                    }
                }
                
                if (mode == "2") {
                    pcd = pcd.filter(function(val) {
                        return !(val.id == nnmbid && val.ptype == pro_ptype)
                    });
                }

            } else {
                if (mode == "1" && pqty > 0) pcd.push({id: nnmbid, qty:  pqty, ptype: pro_ptype});
            }
        }
        
        if (mode == 1 || mode == 2) {
            
            if (pcart == "") {
                if (await DataInsert(`tbl_doctor_product_cart`, `customer_id, doctor_id, prescription, product_id_list`, `'${uid}', '${doctor_id}', '[]', '${JSON.stringify(pcd)}'`, 
                    req.hostname, req.protocol) == -1) {
                    return res.status(200).json({ message: process.env.dataerror, status: false });
                }
            } else if (pcd != '' && pcart != '') {
                if (await DataUpdate(`tbl_doctor_product_cart`, `product_id_list = '${JSON.stringify(pcd)}'`, `id = '${pcart[0].id}'`, req.hostname, req.protocol) == -1) {
                    return res.status(200).json({ message: process.env.dataerror, status: false });
                }
            } else if (pcd == '' && pcart != '') {
                if (await DataDelete(`tbl_doctor_product_cart`, `id = '${pcart[0].id}'`, req.hostname, req.protocol) == -1) {
                    return res.status(200).json({ message: process.env.dataerror, status: false });
                }
            }
        }

        let cplist = [];
        if (pcd != '' && mode == 0) {
            let ids = pcd.map(val => {
                return val.id;
            });
            
            const cstlist = await DataFind(`SELECT id, product_image, product_name, pro_type, prescription_require, price_detail FROM tbl_doctor_store_product WHERE id IN (${ids.join(',')}) AND status = '1'`);
            if (cstlist == '') return res.status(200).json({ResponseCode: 200, Result:true, message: 'Cart load successful', tot_price: 0, cart_list: [] });
            
            cstlist.forEach(val => {
                let csl = pcd.filter(nv => nv.id == val.id);
                
                if (csl != '') {
                    let cval = [];
                    csl.map(vval => {
                        let d = val.price_detail.find(val => val.title == vval.ptype);
                        cval.push({ "title": vval.ptype, "price": d ? d.price : 0, "bprice": d ? d.base_price : 0, "discount": d ? d.discount : 0, "qty": vval.qty });
                        tot_price += (d ? d.price : 0) * vval.qty;
                    });

                    cplist.push({
                        id: val.id,
                        product_image: val.product_image.split("&!!")[0],
                        product_name: val.product_name,
                        pro_type: val.pro_type,
                        prescription_require: val.prescription_require,
                        tot_value: cval
                    });
                }
            });
        }

        return res.status(200).json({ResponseCode: 200, Result:true, message: 'Cart load successful', cplist });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





// ============= Proccess checkout ================ //

router.post('/checkout_data', async(req, res)=>{
    try {
        const {uid, doctor_id} = req.body;
        const missingField = await AllFunction.BodyDataCheck(["uid", "doctor_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        let cw = await DataFind(`SELECT id, tot_balance FROM tbl_customer WHERE id = '${uid}';`);

        const pcart = await DataFind(`SELECT COALESCE(JSON_ARRAYAGG(jt.id), JSON_ARRAY()) AS ids, JSON_ARRAYAGG(JSON_OBJECT('id', jt.id, 'qty', jt.qty, 'price', jt.price, 'ptype', jt.ptype)) AS mix 
                                    FROM tbl_doctor_product_cart 
                                    JOIN JSON_TABLE(tbl_doctor_product_cart.product_id_list, "$[*]" COLUMNS (id INT PATH "$.id", qty INT PATH "$.qty", price INT PATH "$.price", ptype LONGTEXT PATH "$.ptype")) AS jt
                                    WHERE tbl_doctor_product_cart.customer_id = '${uid}' AND tbl_doctor_product_cart.doctor_id = '${doctor_id}';`);
        
        if (pcart != '') {
            if (typeof pcart[0].ids == "string") pcart[0].ids = JSON.parse(pcart[0].ids);
            if (typeof pcart[0].mix == "string") pcart[0].mix = JSON.parse(pcart[0].mix);
        }
        
        let cplist = [], tot_price = 0;
        if (pcart[0].ids.length != 0 || pcart[0].mix != null) {

            let ids = pcart[0].mix.map(val => {
                return val.id;
            });

            const cstlist = await DataFind(`SELECT id, product_image, product_name, pro_type, prescription_require, price_detail FROM tbl_doctor_store_product WHERE id IN (${ids.join(',')}) AND status = '1'`);
            if (cstlist == '') return res.status(200).json({ResponseCode: 200, Result:true, message: 'Cart load successful', tot_price: 0, cart_list: [] });

            cstlist.forEach(val => {
                let csl = pcart[0].mix.filter(nv => nv.id == val.id);
                
                if (csl != '') {
                    let cval = []
                    csl.map(vval => {
                        let d = val.price_detail.find(val => val.title == vval.ptype)
                        cval.push({ "title": vval.ptype, "price": d ? d.price : 0, "base_price": d ? d.base_price : 0, "discount": d ? d.discount : 0, "cart_qty": vval.qty });
                        tot_price += (d ? d.price : 0) * vval.qty;
                    });

                    cplist.push({
                        id: val.id,
                        product_image: val.product_image.split("&!!")[0],
                        product_name: val.product_name,
                        pro_type: val.pro_type,
                        prescription_require: val.prescription_require,
                        price_detail: cval
                    });
                }
            });
        }

        const com_data = await DataFind(`SELECT commission_rate, commisiion_type FROM tbl_general_settings`);

        return res.status(200).json({ResponseCode: 200, Result:true, message: 'Data load successful', wallet_amount: cw != '' ? cw[0].tot_balance : 0, tot_price, com_data:com_data[0], 
            product_list: cplist });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// ============= Coupon list ================ //

router.post('/coupon_list', async(req, res)=>{
    try {
        const {doctor_id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["doctor_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        let date = new Date().toISOString().split("T")[0];
        
        const coupon = await DataFind(`SELECT id, doctor_id, title, sub_title, code, min_amount, discount_amount, start_date, end_date
                                        FROM tbl_coupon WHERE doctor_id = '${doctor_id}' AND start_date <= '${date}' AND end_date >= '${date}'`);

        coupon.map(cval => {
            cval.start_date = new Date(cval.start_date).toISOString().split("T")[0];
            cval.end_date = new Date(cval.end_date).toISOString().split("T")[0];
        });

        return res.status(200).json({ResponseCode: 200, Result:true, message: 'Data load successful', coupon_list: coupon });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// ============= Add Patient Prescription ================ //

AllFunction.ImageUploadFolderCheck(`./public/uploads/medicine_patient_prescription`);
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/uploads/medicine_patient_prescription");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);

    }
});

const mpp = multer({storage : storage});

router.post('/add_patient_prescription', mpp.array("image"), async(req, res)=>{
    try {
        const {uid, doctor_id} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["uid", "doctor_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const pcart = await DataFind(`SELECT id, prescription FROM tbl_doctor_product_cart WHERE customer_id = '${uid}' AND doctor_id = '${doctor_id}'`);
        if (pcart == '') return res.status(200).json({ResponseCode: 200, Result:true, message: 'Please add medicine!' });
        if (!req.files) return res.status(200).json({ResponseCode: 200, Result:true, message: 'Prescription not found!' });

        pcart[0].prescription = typeof pcart[0].prescription == "string" ? JSON.parse(pcart[0].prescription) : pcart[0].prescription;

        let images = [];
        if (pcart[0].prescription != '') {
            for (let img of pcart[0].prescription) {
                await AllFunction.DeleteImage(img);
            }
        }

        for (let img of req.files) {
            images.push(`uploads/medicine_patient_prescription/${img.filename}`);
        }

        if (await DataUpdate(`tbl_doctor_product_cart`, `prescription = '${JSON.stringify(images)}'`, `id = '${pcart[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ message: process.env.dataerror, status: false });
        }

        return res.status(200).json({ResponseCode: 200, Result:true, message: 'Patient prescription add successful' });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// ============= Add product order ================ //

router.post('/add_product_order', async(req, res)=>{
    const {uid, doctor_id, tot_price, coupon, coupon_amount, address, wallet_amount, site_commission, payment_id, transactionId} = req.body;

    const missingField = await AllFunction.BodyNumberDataCheck(["uid", "doctor_id", "tot_price", "coupon", "coupon_amount", "address", "wallet_amount", "site_commission", "payment_id"], req.body);
    if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

    let order = 0
    try {
        
        let pcart = await DataFind(`SELECT cart.id, cart.prescription, COALESCE(JSON_ARRAYAGG(prod_item.pid), JSON_ARRAY()) AS ids,
                                JSON_ARRAYAGG(
                                    JSON_OBJECT(
                                        'id', prod_item.pid,
                                        'qty', prod_item.qty,
                                        'ptype', prod_item.ptype,
                                        'price', (
                                            SELECT pd.price
                                            FROM JSON_TABLE(dsp.price_detail, '$[*]'
                                                COLUMNS (
                                                    title VARCHAR(100) PATH '$.title',
                                                    price DECIMAL(10,2) PATH '$.price'
                                                )
                                            ) AS pd
                                            WHERE pd.title = prod_item.ptype
                                            LIMIT 1
                                        ),
                                        'pre_require', dsp.prescription_require
                                    )
                                ) AS mix
                                -- .MAX(CASE WHEN dsp.prescription_require = 'Required' THEN 'Required' ELSE 'Unrequired' END) AS prescription_require
                                FROM tbl_doctor_product_cart AS cart
                                JOIN JSON_TABLE(cart.product_id_list, '$[*]' 
                                    COLUMNS (
                                        pid INT PATH '$.id',
                                        qty INT PATH '$.qty',
                                        ptype VARCHAR(100) PATH '$.ptype'
                                    )
                                ) AS prod_item
                                JOIN tbl_doctor_store_product AS dsp ON dsp.id = prod_item.pid
                                WHERE cart.customer_id = '${uid}' AND cart.doctor_id = '${doctor_id}'
                                GROUP BY cart.id;`);
                                      
        if (pcart == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Data not found!' });
        pcart[0].prescription = typeof pcart[0].prescription == "string" ? JSON.parse(pcart[0].prescription) : pcart[0].prescription;
        
        let reqids = new Set();
        pcart[0].mix.forEach(item => {
            if (item.pre_require === "Required" && !reqids.has(item.id)) {
                reqids.add(item.id);
            }
        });
        
        if (reqids.size > 0 && pcart[0].prescription == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Upload Medicine prescription!' });
        
        let date = new Date().toISOString();

        order = await DataInsert(`tbl_order_product`, `customer_id, doctor_id, product_list, medicine_prescription, status, tot_price, coupon_id, coupon_amount, wallet,
            site_commission, payment_id, address_id, date, cancel_id, cancel_reason, transactionId`, `'${uid}', '${doctor_id}', '${JSON.stringify(pcart[0].mix)}', 
            '${JSON.stringify(pcart[0].prescription)}', '0', '${tot_price}', '${coupon}', '${coupon_amount}', '${wallet_amount}', '${site_commission}',
            '${payment_id}', '${address}', '${date}', '', '', '${transactionId}'`, req.hostname, req.protocol);

        if (order == -1) return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });

        if (wallet_amount > 0) {
            let cw = await DataFind(`SELECT id, tot_balance FROM tbl_customer WHERE id = '${uid}';`);            
            if (cw == "") return res.status(200).json({ ResponseCode: 401, Result:false, message: 'User not found!' });

            let totw = cw[0].tot_balance - wallet_amount;

            if (await DataInsert(`tbl_customer_wallet`, `customer_id, amount, date, payment_type, status, amount_type`,
                `'${uid}', '${wallet_amount}', '${date.split("T")[0]}', '0', '4', '${order.insertId}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status: false });
            }

            if (await DataUpdate(`tbl_customer`, `tot_balance = '${totw}'`, `id = '${cw[0].id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ message: process.env.dataerror, status: false });
            }
        }

        if (await DataDelete(`tbl_doctor_product_cart`, `id = '${pcart[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        let ms = `🕒 Your order has been received and is pending confirmation. Order ID : # ${order.insertId}`; 
        sendOneNotification(ms, 'customer', uid, 1);
        sendOneNotification(ms, 'customer', uid, 2);
        if (await DataInsert(`tbl_notification`, `order_id, customer_id, service_user_id, date, mstatus, ostatus, notification`,
            `'${order.insertId}', '${uid}', '${doctor_id}', '${AllFunction.NotificationDate(date)}', '3', '1', '${ms}'`, req.hostname, req.protocol) == -1) {

            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

        return res.status(200).json({ResponseCode: 200, Result:true, message: 'Order placed successful' });

    } catch (error) {

        const customer = cw = await DataFind(`SELECT id, tot_balance FROM tbl_customer WHERE id = '${uid}';`);   
        if (tot_price > 0 && customer != '') {
            // console.log(222);
            const tot_amount = customer[0].tot_balance + tot_price;
    
            if (await DataUpdate(`tbl_customer`, `tot_balance = '${tot_amount}'`, `id = '${customer[0].id}'`, hostname, protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }
    
            if (await DataInsert(`tbl_customer_wallet`, `customer_id, amount, date, payment_type, status, amount_type`,
                `'${customer[0].id}', '${tot_price}', '${new Date().toISOString().split("T")[0]}', '0', '10', '${payment_id}'`, hostname, protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }
        }
    
        if (order != 0) {
            // console.log(333);
            if (await DataDelete(`tbl_order_product`, `id = '${order.insertId}'`, hostname, protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }
        }

        console.log(error);
        res.status(500).json({ Result: false, error: 'Internal server error' });
    }
});



// ============= Product order sitter list ================ //

router.post('/total_store_order_list', async(req, res)=>{
    try {
        const {uid} = req.body;

        

        const or = await DataFind(`SELECT or_pro.id, or_pro.doctor_id, 

                                    COALESCE(dsd.image, '') AS image, COALESCE(dsd.name, '') AS name, COALESCE(dsd.address, '') AS address

                                    FROM tbl_order_product AS or_pro

                                    JOIN tbl_doctor_store_detail AS dsd ON dsd.doctor_id = or_pro.doctor_id

                                    GROUP BY or_pro.id, or_pro.doctor_id, dsd.image, dsd.name, dsd.address;`);
            
        return res.status(200).json({ResponseCode: 200, Result:true, message: 'Data load successful', store_list: or });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// ============= Product order list ================ //

router.post('/order_list', async(req, res)=>{
    try {
        const {uid} = req.body;
        const missingField = await AllFunction.BodyDataCheck(["uid"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const running = await DataFind(`SELECT op.id, op.doctor_id, op.status, op.tot_price, op.date, JSON_LENGTH(COALESCE(JSON_ARRAYAGG(jt.id), JSON_ARRAY())) AS tot_product,

                                        COALESCE(dsd.image, '') AS image, COALESCE(dsd.name, '') AS name, COALESCE(dsd.address, '') AS address

                                        FROM tbl_order_product AS op

                                        JOIN JSON_TABLE(op.product_list, "$[*]"
                                            COLUMNS ( id INT PATH "$.id", qty INT PATH "$.qty" )
                                        ) AS jt

                                        JOIN tbl_doctor_store_detail AS dsd ON dsd.doctor_id = op.doctor_id
                                        
                                        WHERE op.customer_id = '${uid}' AND op.status IN ('0', '1', '2')

                                        GROUP BY op.id, dsd.image, dsd.name, dsd.address ORDER BY op.id DESC;`);

        running.map(val => {
            const date = new Date(val.date);
            const formattedDate = date.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }); 
            val.date = formattedDate;
            return val;
        });
        
        const complete = await DataFind(`SELECT op.id, op.doctor_id, op.status, op.tot_price, op.date, JSON_LENGTH(COALESCE(JSON_ARRAYAGG(jt.id), JSON_ARRAY())) AS tot_product,

                                        COALESCE(dsd.image, '') AS image, COALESCE(dsd.name, '') AS name, COALESCE(dsd.address, '') AS address

                                        FROM tbl_order_product AS op

                                        JOIN JSON_TABLE(op.product_list, "$[*]"
                                            COLUMNS ( id INT PATH "$.id", qty INT PATH "$.qty" )
                                        ) AS jt

                                        JOIN tbl_doctor_store_detail AS dsd ON dsd.doctor_id = op.doctor_id
                                        
                                        WHERE op.customer_id = '${uid}' AND op.status IN ('3', '4')

                                        GROUP BY op.id, dsd.image, dsd.name, dsd.address ORDER BY op.id DESC;`);

        complete.map(val => {
            const date = new Date(val.date);
            const formattedDate = date.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }); 
            val.date = formattedDate;
            return val;
        });

        return res.status(200).json({ResponseCode: 200, Result:true, message: 'Data load successful', running, complete });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// ============= Product order detail ================ //

router.post('/product_order_detail', async(req, res)=>{
    try {
        const {uid, order_id} = req.body;
        const missingField = await AllFunction.BodyDataCheck(["uid", "order_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const or = await DataFind(`SELECT op.*, 0 AS sitter_amount, COALESCE(payd.name, '') AS payment_name, COALESCE(JSON_ARRAYAGG(jt.id), JSON_ARRAY()) AS ids, COALESCE(cadd.house_no, '') AS house_no,
                                    COALESCE(cadd.address, '') AS address, COALESCE(cadd.landmark, '') AS landmark, op.transactionId
                                    FROM tbl_order_product AS op
                                    JOIN
                                        JSON_TABLE(op.product_list, "$[*]" 
                                            COLUMNS (
                                                id INT PATH "$.id", qty INT PATH "$.qty"
                                            )
                                        ) AS jt
                                    LEFT JOIN tbl_payment_detail AS payd ON payd.id = op.payment_id
                                    LEFT JOIN tbl_customer_address AS cadd ON cadd.id = op.address_id
                                    WHERE op.id = '${order_id}'
                                    GROUP BY op.id;`);

        if (or == '') return res.status(200).json({ ResponseCode: 401, Result:false, message: 'Order not found!' });
        or[0].product_list = typeof or[0].product_list == "string" ? JSON.parse(or[0].product_list) : or[0].product_list;
        or[0].medicine_prescription = typeof or[0].medicine_prescription == "string" ? JSON.parse(or[0].medicine_prescription) : or[0].medicine_prescription;

        or[0].sitter_amount = or[0].tot_price - or[0].site_commission;
            
        if (or[0].wallet != 0 && or[0].payment_name != '') or[0].online_amount = Number((or[0].tot_price - or[0].wallet).toFixed(2));
        else if (or[0].wallet == 0 && or[0].payment_name != '') or[0].online_amount = or[0].tot_price;
        else or[0].online_amount = 0;
        
        let cplist = [], tot_price = 0;
        if (or[0].ids.length != 0) {

            const cstlist = await DataFind(`SELECT sittp.id, sittp.product_image, sittp.product_name, sittp.pro_type, sittp.prescription_require, sittp.price_detail,
                                            COALESCE(subs.name, '') AS sub_category_name, COALESCE(cate.name, '') AS category_name
                                            FROM tbl_doctor_store_product AS sittp
                                            LEFT JOIN tbl_store_subcategory AS subs ON subs.id = sittp.sub_category_id
                                            LEFT JOIN tbl_store_category AS cate ON cate.id = subs.category_id
                                            WHERE sittp.id IN (${or[0].ids.join(',')}) AND sittp.status = '1'`);
            if (cstlist == '') return res.status(200).json({ResponseCode: 200, Result:true, message: 'Cart load successful', tot_price: 0, cart_list: [] });
            
            cstlist.forEach(val => {
                let csl = or[0].product_list.filter(nv => nv.id == val.id);
                
                if (csl != '') {
                    let cval = []
                    csl.map(vval => {
                        let d = val.price_detail.find(val => val.title == vval.ptype);
                        cplist.push({
                            id: val.id,
                            product_image: val.product_image.split("&!!")[0],
                            product_name: val.product_name,
                            pro_type: val.pro_type,
                            sub_category_name: val.sub_category_name,
                            category_name: val.category_name,
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

        delete or[0].product_list; delete or[0].ids;

        return res.status(200).json({ResponseCode: 200, Result:true, message: 'Data load successful', order_detail: or[0], product_list: cplist });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post("/product_order_cancel", async(req, res)=>{
    try {
        const {order_id, cancel_id, reason} = req.body;

        const missingField = await AllFunction.BodyDataCheck(["order_id", "cancel_id"], req.body);
        if (missingField.status == false) return res.status(200).json({ ResponseCode: 401, Result:false, message: missingField.message });

        const unorder = await DataFind(`SELECT ord.id, ord.customer_id, ord.doctor_id, ord.tot_price, COALESCE(cus.id, 0) as cid, COALESCE(cus.tot_balance, 0) as cbalance
                                        FROM tbl_order_product as ord
                                        JOIN tbl_customer as cus ON cus.id = ord.customer_id
                                        WHERE ord.id = '${order_id}'`);
        
        if (unorder == "") return res.status(200).json({ResponseCode: 200, Result:true, message: 'Order not found!' });

        let untotal = unorder[0].tot_price, twallet = Number(unorder[0].cbalance) + Number(unorder[0].tot_price), date = new Date();
        
        if (await DataUpdate(`tbl_customer`, `tot_balance = '${twallet.toFixed(2)}'`, `id = '${unorder[0].cid}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ message: process.env.dataerror, status: false });
        }

        if (await DataInsert(`tbl_customer_wallet`, `customer_id, amount, date, payment_type, status, amount_type`,
            `'${unorder[0].customer_id}', '${untotal}', '${date.toISOString().split("T")[0]}', '0', '3', '${unorder[0].id}'`, req.hostname, req.protocol) == -1) {
            
            return res.status(200).json({ message: process.env.dataerror, status: false });
        }

        const oreason = mysql.escape(reason);
        if (await DataUpdate(`tbl_order_product`, `status = '4', cancel_id = '${cancel_id}', cancel_reason = ${oreason}`, `id = '${unorder[0].id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ message: process.env.dataerror, status: false });
        }

        let ms = `❌ Your order has been canceled. If this was a mistake, please contact support. Order ID : # ${unorder[0].id}`;
        sendOneNotification(ms, 'customer', unorder[0].customer_id, 1);
        sendOneNotification(ms, 'customer', unorder[0].customer_id, 2);
        if (await DataInsert(`tbl_notification`, `order_id, customer_id, service_user_id, date, mstatus, ostatus, notification`,
            `'${unorder[0].id}', '${unorder[0].customer_id}', '${unorder[0].doctor_id}', '${AllFunction.NotificationDate(date)}', '3', '5', '${ms}'`, req.hostname, req.protocol) == -1) {

            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }
        
        return res.status(200).json({ResponseCode: 200, Result:true, message: 'Order cancel successful!' });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





module.exports = router;
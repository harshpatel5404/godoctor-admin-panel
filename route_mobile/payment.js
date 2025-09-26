/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */


const express = require("express");
const router = express.Router();
const axios = require('axios');
const AllFunction = require("../route_function/function");
const { DataFind, DataInsert, DataDelete } = require("../middleware/database_query");



const LocalURL = "";

// ============= Paypal Payment ================ //
const paypal = require('paypal-rest-sdk');

// Create a PayPal payment
router.post('/paypal-payment', async(req, res) => {
    const { amount, uid, status } = req.body;

    const missingField = await AllFunction.BodyDataCheck(["amount", "uid"], req.body);
    if (missingField.status == false) return res.status(200).json({ message: 'Data Not Found!', status:false});

    try {
        const admin_data = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${uid}'`);
        if (admin_data == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});
        
        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail WHERE id = '2'`);
        // if (payment_detail == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});
        if (payment_detail == "") return { status: false, message: 'Something Went Wrong!' };
        
        let pkey = payment_detail[0].attribute.split(",");
        if (pkey == "" || pkey == undefined) return { status: false, message: 'Something Went Wrong!' };

        paypal.configure({
            mode: pkey[2], // sandbox or live
            client_id: pkey[0],
            client_secret: pkey[1]
        });

        const paymentData = {
            intent: 'sale',
            payer: {
                payment_method: 'paypal',
                payer_info: {
                    email: admin_data[0].email,
                    first_name: "test"
                }
            },
            redirect_urls: {
                
                return_url: status == 0 ? `${req.protocol}://${req.get('host')}/customer/paypal-success?status=0` : 
                                                        `${req.protocol}://${req.get('host')}/customer/paypal-success${status ? `?status=${status}` : ''}`,
                cancel_url: status == 0 ? `${req.protocol}://${req.get('host')}/customer/paypal-success?status=0` : 
                                                        `${req.protocol}://${req.get('host')}/customer/paypal-success${status ? `?status=${status}` : ''}`
            },
            transactions: [{
                amount: {
                    total: amount,
                    currency: 'USD'
                },
                description: "This is the payment description."
            }]
        };

        paypal.payment.create(paymentData, function (error, payment) {
            if (error) {
                // console.error('Error creating payment:', error);
                return res.status(200).send({ message: 'Paypal Payment URL Not Generated!', status: false });
                
                // return { status: false, message: 'Paypal Payment URL Not Generated!' };
            } else {
                const approvalUrl = payment.links.find(link => link.rel === 'approval_url').href;
                console.log(approvalUrl);
                // return { status: true, message: 'Paypal Payment URL Generate Successful', paypalURL: approvalUrl };
                return res.status(200).send({ message: 'Paypal Payment URL Generate Successful', status: true, paypalURL: approvalUrl });
            }
        });

    } catch (error) {
        console.error(error);
        // res.status(500).json({ error: 'Internal server error' });

        const pd = await DataFind(`SELECT * FROM tbl_general_settings`);

        if (status == 0) return res.status(200).send({ status: false, message: 'Payment not Working' });
        else return res.redirect(`${pd != '' ? pd[0].web_pay_success_url + '/paymentresponse' : ''}?status=false&transactionId=0`);
    }
});

router.get('/paypal-success', async(req, res) => {
    try {
        const { paymentId, PayerID, status } = req.query;
        
        const executePaymentData = {
            payer_id: PayerID
        };
        
        const pd = await DataFind(`SELECT * FROM tbl_general_settings`);
        paypal.payment.execute(paymentId, executePaymentData, async(error, payment) => {
            if (error) {
                console.error('Error executing payment:', error);

                if (status != 0) return res.redirect(`${pd != '' ? pd[0].web_pay_success_url + '/paymentresponse' : ''}?status=false&transactionId=0`);
                else return res.status(200).send({ message: 'Paypal Payment Cancel', status: false, transactionId: 0 });

            } else {
                const transactionId = payment.transactions?.[0]?.related_resources?.[0]?.sale?.id || '';
                
                if (status != 0) return res.redirect(`${pd != '' ? pd[0].web_pay_success_url + '/paymentresponse' : ''}?status=true&transactionId=${transactionId}`);
                else return res.status(200).send({ message: "Payment Successfully", status: true, transactionId: transactionId });
                
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





// ============= Strip Payment ================ //

router.post('/strip-payment', async(req, res)=>{
    const { amount, uid, status } = req.body;

    const missingField = await AllFunction.BodyDataCheck(["amount", "uid"], req.body);
    if (missingField.status == false) return res.status(200).json({ message: 'Data Not Found!', status:false});

    try {

        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail WHERE id = '3'`);
        if (payment_detail == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});
        
        const admin_data = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${uid}'`);
        if (admin_data == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});
        

        let pkey = ''
        try {
            pkey = payment_detail[0].attribute.split(",");
        } catch (error) {
            console.log(error);
            return res.status(200).json({ message: 'Something Went Wrong!', status:false});
        }
        if (pkey == "" || pkey == undefined) return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const stripe = require('stripe')(pkey[1]);

        // const dynamicPrice = amount * 100; 
        const dynamicPrice = Math.round(amount * 100);

        const price = await stripe.prices.create({
            unit_amount: dynamicPrice,
            currency: 'inr',
            product_data: {
                name: admin_data[0].name,
            },
        });

        const priceId = price.id;
        stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: "payment",
        line_items: [{
            price: priceId,
            quantity: 1,
        }],
        customer_email: admin_data[0].email, // Optional if you have the email
        billing_address_collection: 'required', // 💡 This is important
        customer_creation: 'always', // Optional: Create customer automatically

        success_url: status == 0 ? `${req.protocol}://${req.get('host')}/customer/strip-success?payment_intent={CHECKOUT_SESSION_ID}&status=0` : 
                                    `${req.protocol}://${req.get('host')}/customer/strip-success?payment_intent={CHECKOUT_SESSION_ID}${status ? `&status=${status}` : ''}`,

        cancel_url: status == 0 ? `${req.protocol}://${req.get('host')}/customer/strip-cencal?payment_intent={CHECKOUT_SESSION_ID}&status=0` : 
                                    `${req.protocol}://${req.get('host')}/customer/strip-cencal?payment_intent={CHECKOUT_SESSION_ID}${status ? `&status=${status}` : ''}`

       

        }).then(session => {
            console.log('session data '+ session.url);
            return res.status(200).send({ message: 'Stripe Payment URL Generate Successful', status: true, StripeURL: session.url });
        }).catch(error => {
            console.error("Error creating Stripe Checkout session:", error);
            return res.status(200).send({ message: 'Stripe Payment URL Not Generated!', status: false });
        });

    } catch (error) {
        console.error(error);

        const pd = await DataFind(`SELECT * FROM tbl_general_settings`);
        if (status == 0) return res.status(200).send({ status: false, message: 'Payment not Working' });
        else return res.redirect(`${pd != '' ? pd[0].web_pay_success_url + '/paymentresponse' : ''}?status=false&transactionId=0`);
    }
});

router.get("/strip-success", async(req, res)=>{
    const { payment_intent, status } = req.query;
    try {
        
        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail`);
        let pkey = payment_detail[2].attribute.split(",");

        const stripe = require('stripe')(pkey[1]);
        
        const session = await stripe.checkout.sessions.retrieve(payment_intent);
        const payment_intenta = session.payment_intent;

        let check = await stripe.paymentIntents.retrieve(payment_intenta);
        const pd = await DataFind(`SELECT * FROM tbl_general_settings`);
        if (check.status == "succeeded") {  

            if (status != 0) return res.redirect(`${pd != '' ? pd[0].web_pay_success_url + '/paymentresponse' : ''}?status=true&transactionId=${check.id}`);
            else return res.status(200).send({ message: "Payment Successfully", status: true, transactionId: check.id });
            // return res.status(200).send({ message: 'Stripe Payment Successful', status: true });

        } else {

            if (status != 0) return res.redirect(`${pd != '' ? pd[0].web_pay_success_url + '/paymentresponse' : ''}?status=false&transactionId=0`);
            else return res.status(200).send({ message: "Payment Successfully", status: false, transactionId: 0 });

        }
    } catch (error) {
        console.error(error);
        const pd = await DataFind(`SELECT * FROM tbl_general_settings`);
        if (status == 0) return res.status(200).send({ status: false, message: 'Internal server error' });
        else return res.redirect(`${pd != '' ? pd[0].web_pay_success_url + '/paymentresponse' : ''}?status=false&transactionId=0`);
        // res.status(500).json({ error: 'Internal server error' });
    }
});

router.get("/strip-cencal", async(req, res)=>{
    const { payment_intent, status } = req.query;
    try {

        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail`);
        let pkey = payment_detail[2].attribute.split(",");
        const stripe = require('stripe')(pkey[1]);
        
        const session = await stripe.checkout.sessions.retrieve(payment_intent);

        const payment_intent_id = session.payment_intent;
        const pd = await DataFind(`SELECT * FROM tbl_general_settings`);
        await stripe.paymentIntents.retrieve(payment_intent_id).catch(error => {
            // console.error("Error Stripe Checkout session: ", error);
            if (status != 0) return res.redirect(`${pd != '' ? pd[0].web_pay_success_url + '/paymentresponse' : ''}?status=false&transactionId=0`);
            else return res.status(200).send({ message: "Payment Successfully", status: false, transactionId: 0 });
        });
    } catch (error) {
        console.error(error);
        const pd = await DataFind(`SELECT * FROM tbl_general_settings`);
        if (status == 0) return res.status(200).send({ status: false, message: 'Internal server error' });
        else return res.redirect(`${pd != '' ? pd[0].web_pay_success_url + '/paymentresponse' : ''}?status=false&transactionId=0`);
        // res.status(500).json({ error: 'Internal server error' });
    }
});



// ============= Paystack Payment ================ //

router.post("/paystack-payment", async(req, res)=>{
    const {amount, uid, status} = req.body;

    const missingField = await AllFunction.BodyDataCheck(["amount", "uid"], req.body);
    if (missingField.status == false) return res.status(200).json({ message: 'Data Not Found!', status:false});

    try {
        
        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail WHERE id = '4'`);
        if (payment_detail == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const admin_data = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${uid}'`);
        if (admin_data == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        let pkey = '';
        try {
            pkey = payment_detail[0].attribute.split(",");
        } catch (error) {
            console.log(error);
            return res.status(200).json({ message: 'Something Went Wrong!', status:false});
        }
        if (pkey == "" || pkey == undefined) return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const paystack = require('paystack')(pkey[1]);

        const options = {
            amount: amount * 100, 
            email: admin_data[0].email,
            name: admin_data[0].name,
            phone: admin_data[0].country_code + ' ' + admin_data[0].phone,
            // callback_url: req.protocol + req.hostname + "/api/paystack-check",

            callback_url: status == 0 ? `${req.protocol}://${req.get('host')}/customer/paystack-check?status=0` : `${req.protocol}://${req.get('host')}/customer/paystack-check${status ? `?status=${status}` : ''}`,

            // callback_url: LocalURL + "/customer/paystack-check",
            metadata: {
                custom_fields: [
                    {
                        display_name: 'Order ID',
                        variable_name: 'order_id',
                        value: '12345'
                    }
                ]
            }
        };

        paystack.transaction.initialize(options, (error, body) => {
            if (!error) {
                const authorization_url = body.data.authorization_url;
                console.log('reference id:', body.data.reference);
                return res.status(200).send({ message: 'Paystack Payment URL Generate Successful', status: true, PaystackURL: authorization_url });
            } else {
                // console.log(error);
                return res.status(200).send({ message: 'Stripe Payment URL Not Generated!', status: false });
            }
        });
    } catch (error) {
        console.error(error);
        const pd = await DataFind(`SELECT * FROM tbl_general_settings`);
        if (status == 0) return res.status(200).send({ status: false, message: 'Payment not Working' });
        else return res.redirect(`${pd != '' ? pd[0].web_pay_success_url + '/paymentresponse' : ''}?status=false&transactionId=0`);
        // res.status(500).json({ error: 'Internal server error' });
    }
});

router.get("/paystack-check", async(req, res)=>{
    const { reference, status } = req.query;
    try {
        const pd = await DataFind(`SELECT * FROM tbl_general_settings`);
        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail WHERE id = '4'`);
        if (payment_detail == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});
        
        let pkey = '';
        try {
            pkey = payment_detail[0].attribute.split(",");
        } catch (error) {
            console.log(error);
            return res.status(200).json({ message: 'Something Went Wrong!', status:false});
        }
        if (pkey == "" || pkey == undefined) return res.status(200).json({ message: 'Something Went Wrong!', status:false});
        
        const paystackVerifyUrl = `https://api.paystack.co/transaction/verify/${reference}`;

        const headers = {
            'accept': 'application/json',
            'Authorization': `Bearer ${pkey[1]}`,
            'cache-control': 'no-cache'
        };
        
        axios
            .get(paystackVerifyUrl, { headers })
            .then((response) => {
            const data = response.data;
            if (data.status === true && data.data.status === 'success') {

                if (status != 0) return res.redirect(`${pd != '' ? pd[0].web_pay_success_url + '/paymentresponse' : ''}?status=true&transactionId=${data.data.id}`);
                else return res.status(200).send({ message: "Payment Successfully", status: true, transactionId: data.data.id });
                // return res.status(200).send({ message: 'Paystack Payment Successful', status: true });

            } else {
                console.log('Transaction was Cancelled');

                if (status != 0) return res.redirect(`${pd != '' ? pd[0].web_pay_success_url + '/paymentresponse' : ''}?status=true&transactionId=0`);
                else return res.status(200).send({ message: "Paystack Payment Cancel!", status: false, transactionId: 0 });
                // return res.status(200).send({ message: 'Paystack Payment Cancel!', status: false });
                
            }
            }).catch((error) => {
                console.error('Error:', error);

                if (status != 0) return res.redirect(`${pd != '' ? pd[0].web_pay_success_url + '/paymentresponse' : ''}?status=true&transactionId=0`);
                else return res.status(200).send({ message: "An error occurred!", status: false, transactionId: 0 });
                // return res.status(200).send({ message: 'An error occurred!', status: false });
            });

    } catch (error) {
        console.error(error);
        const pd = await DataFind(`SELECT * FROM tbl_general_settings`);
        if (status != 0) return res.redirect(`${pd != '' ? pd[0].web_pay_success_url + '/paymentresponse' : ''}?status=true&transactionId=0`);
        else return res.status(200).send({ message: "Internal server error", status: false, transactionId: 0 });
        // res.status(500).json({ error: 'Internal server error' });
    }
});





// ============= Paystack Payment ================ //

router.post("/flutterwave-payment", async(req, res)=>{
    const {amount, uid, status} = req.body;
    const missingField = await AllFunction.BodyDataCheck(["amount", "uid"], req.body);
    if (missingField.status == false) return res.status(200).json({ message: 'Data Not Found!', status:false});

    try {
        
        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail WHERE id = '5'`);
        if (payment_detail == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});
        
        let pkey = '';
        try {
            pkey = payment_detail[0].attribute.split(",");
        } catch (error) {
            console.log(error);
            return res.status(200).json({ message: 'Something Went Wrong!', status:false});
        }
        if (pkey == "" || pkey == undefined) return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const admin_data = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${uid}'`);
        if (admin_data == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const general_setting = await DataFind(`SELECT * FROM tbl_general_settings`);


        await axios.post("https://api.flutterwave.com/v3/payments", {
            tx_ref: Date.now(),
            amount: amount,
            currency: "NGN",
            // redirect_url: req.protocol + req.hostname + "/api/flutterwave-check",

            redirect_url: status == 0 ? `${req.protocol}://${req.get('host')}/customer/flutterwave-check?typecheck=0` : `${req.protocol}://${req.get('host')}/customer/flutterwave-check${status ? `?typecheck=${status}` : ''}`,

            // redirect_url: LocalURL + "/customer/flutterwave-check",
            customer: {
                email: admin_data[0].email,
                phonenumber: admin_data[0].country_code + ' ' + admin_data[0].phone,
                name: admin_data[0].name
            },
            customizations: {
                title: general_setting[0].title,
                // logo: req.protocol + req.hostname + general_setting[0].dark_image
                logo: `${req.protocol}://${req.get('host')}/${general_setting[0].dark_image}`
            }
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${pkey[0]}`
            }
        }).then(session => {
            console.log(session.data.data.link);
            return res.status(200).send({ message: 'FlutterWave Payment URL Generate Successful', status: true, FlutterwaveURL: session.data.data.link });
        }).catch(error => {
            console.error("Error creating FlutterWave Checkout session:", error);
            return res.status(200).send({ message: 'FlutterWave Payment URL Not Generated!', status: false });
        });
        
    } catch (error) {
        console.error(error);
        const pd = await DataFind(`SELECT * FROM tbl_general_settings`);
        if (status != 0) return res.redirect(`${pd != '' ? pd[0].web_pay_success_url + '/paymentresponse' : ''}?status=true&transactionId=0`);
        else return res.status(200).send({ message: "Internal server error", status: false });
    }
});



router.get("/flutterwave-check", async(req, res)=>{
    try {
        const { transaction_id, tx_ref, status, typecheck } = req.query;
        const tx_id = transaction_id || tx_ref; // 🔁 fallback for safety

        if (status === 'successful') {
            const pd = await DataFind(`SELECT * FROM tbl_general_settings`);
            const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail WHERE id = '5'`);
            if (payment_detail == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});
            
            let pkey = '';
            try {
                pkey = payment_detail[0].attribute.split(",");
            } catch (error) {
                console.log(error);
                return res.status(200).json({ message: 'Something Went Wrong!', status:false});
            }
            if (pkey == "" || pkey == undefined) return res.status(200).json({ message: 'Something Went Wrong!', status:false});

            await axios.get(`https://api.flutterwave.com/v3/transactions/${tx_id}/verify`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${pkey[0]}`
                }
            }).then(response => {
                if (response.data.data.status === 'successful') {
                    console.log("Flutterwave Payment Successful!");
                    if (typecheck != 0) return res.redirect(`${pd != '' ? pd[0].web_pay_success_url + '/paymentresponse' : ''}?status=true&transactionId=${response.data.data.id}`);
                    else return res.status(200).send({ message: "Payment Successfully", status: true, transactionId: response.data.data.id });
                    // return res.status(200).send({ message: 'Flutterwave Payment Successful', status: true });
                } else {
                    console.log("Flutterwave Payment Failed!");
                    if (typecheck != 0) return res.redirect(`${pd != '' ? pd[0].web_pay_success_url + '/paymentresponse' : ''}?status=true&transactionId=0`);
                    else return res.status(200).send({ message: "Flutterwave Payment Failed!", status: false, transactionId: 0 });
                    // return res.status(200).send({ message: 'Flutterwave Payment Failed!', status: false });
                }
                
            }).catch(error => {
                console.log("Flutterwave Payment Failed!", error);
                if (typecheck != 0) return res.redirect(`${pd != '' ? pd[0].web_pay_success_url + '/paymentresponse' : ''}?status=true&transactionId=0`);
                else return res.status(200).send({ message: "Flutterwave Payment Failed!", status: false, transactionId: 0 });
                // return res.status(200).send({ message: 'Flutterwave Payment Failed!', status: false });
            });
        } else {
            console.log("Transaction status not successful!");
            if (typecheck != 0) return res.redirect(`${pd != '' ? pd[0].web_pay_success_url + '/paymentresponse' : ''}?status=true&transactionId=0`);
            else return res.status(200).send({ message: "Transaction not Unsuccessful!", status: false, transactionId: 0 });
            // return res.status(200).send({ message: 'Transaction not successful!', status: false });
        }
    } catch (error) {
        console.error(error);
        const pd = await DataFind(`SELECT * FROM tbl_general_settings`);
        if (typecheck != 0) return res.redirect(`${pd != '' ? pd[0].web_pay_success_url + '/paymentresponse' : ''}?status=true&transactionId=0`);
        else return res.status(200).send({ message: "Internal server error", status: false, transactionId: 0 });
        // res.status(500).json({ error: 'Internal server error' });
    }
});





// ============= Senangpay Payment ================ //
const crypto = require("crypto");

router.post("/senangpay-payment", async(req, res)=>{
    const {amount, uid, status} = req.body;
    const missingField = await AllFunction.BodyDataCheck(["amount", "uid"], req.body);
    if (missingField.status == false) return res.status(200).json({ message: 'Data Not Found!', status:false});
    console.log(req.body.uid);
    
    try {
        // Ensure amount is a number
        if (isNaN(amount)) {
            return res.status(400).send({ message: 'Invalid amount', status: false });
        }

        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail WHERE id = '7'`);
        if (payment_detail == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});
        
        let pkey = '';
        try {
            pkey = payment_detail[0].attribute.split(",");
        } catch (error) {
            console.log(error);
            return res.status(200).json({ message: 'Something Went Wrong!', status:false});
        }
        if (pkey == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const admin_data = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${uid}'`);
        if (admin_data == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        
        
        const MERCHANT_ID = pkey[0];
        const SECRET_KEY = pkey[1];

        const timestamp = Date.now();
        const orderId = timestamp.toString();
        const cartDetail = `Shopping_cart_id_${timestamp + 1}`;
        const am = parseFloat(amount).toFixed(2);

        // Create hash
        const data = `${MERCHANT_ID}${timestamp}${am}${SECRET_KEY}`;
        const hash = crypto.createHash('sha256').update(data).digest('hex');

        // Request payload
        const detail = {
            detail: cartDetail,
            amount: am,
            order_id: orderId,
            order_number: orderId,
            name: admin_data[0].name,
            email: admin_data[0].email,
            phone: admin_data[0].phone,
            hash: hash,
            callback_url: status == 0 ? `${req.protocol}://${req.get('host')}/customer/senangpay-success?typecheck=0` : `${req.protocol}://${req.get('host')}/customer/senangpay-success?typecheck=${status || 1}`
        };

        // Final payment link
        const sandboxBaseUrl = "https://sandbox.senangpay.my/payment/";
        const paymentLink = `${sandboxBaseUrl}?${new URLSearchParams(detail).toString()}`;

        
        
        if (paymentLink) {
            console.log(paymentLink);
            return res.status(200).send({ message: 'SenangPay Payment URL Generate Successful', status: true, SenangPayURL: paymentLink });
            // res.redirect(paymentLink);
        } else {
            console.error("Error creating SenangPay Checkout session:", error);
            return res.status(200).send({ message: 'SenangPay Payment URL Not Generated!', status: false });
            // res.redirect({ message: 'SenangPay Payment URL Not Generated!', status: false });
        }
    } catch (error) {
        console.error(error);
        const pd = await DataFind(`SELECT * FROM tbl_general_settings`);
        if (status != 0) return res.redirect(`${pd != '' ? pd[0].web_pay_success_url + '/paymentresponse' : ''}?status=true&transactionId=0`);
        else return res.status(200).send({ message: "Internal server error", status: false });
        // res.status(500).json({ error: 'Internal server error' });
    }
});

router.get("/senangpay-success", async(req, res)=>{
    try {
        const { transaction_id, status_id, order_id, msg, hash, typecheck } = req.query;

        console.log("SenangPay Callback Received:", req.query);

        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail WHERE id = '7'`);
        if (payment_detail == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});
        
        let pkey = '';
        try {
            pkey = payment_detail[0].attribute.split(",");
        } catch (error) {
            console.log(error);
            return res.status(200).json({ message: 'Something Went Wrong!', status:false});
        }
        if (pkey == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const SECRET_KEY = pkey[1];

        if (!transaction_id || !status_id || !order_id || !hash) {
            return res.status(400).send({ message: "Missing required parameters", status: false });
        }

        const rawString = `${SECRET_KEY}${status_id}${order_id}${transaction_id}`;
        const expectedHash = crypto.createHash('sha256').update(rawString).digest('hex');

        if (expectedHash !== hash) {
            console.warn("❌ Hash mismatch — possible tampering or invalid secret key");
            return res.status(403).send({ message: "Invalid payment response (hash mismatch)", status: false });
        }
        const pd = await DataFind(`SELECT * FROM tbl_general_settings`);
        if (status_id === "1") {
            if (typecheck != 0) return res.redirect(`${pd != '' ? pd[0].web_pay_success_url + '/paymentresponse' : ''}?status=true&transactionId=${transaction_id}`);
            else return res.status(200).send({ message: "Payment Successful", status: true, transactionId: transaction_id });
            
        } else {
            if (typecheck != 0) return res.redirect(`${pd != '' ? pd[0].web_pay_success_url + '/paymentresponse' : ''}?status=true&transactionId=0`);
            else return res.status(200).send({ message: "Payment Failed!", status: false, transactionId: 0 });
        }
    } catch (error) {
        console.error(error);
        const pd = await DataFind(`SELECT * FROM tbl_general_settings`);
        if (typecheck != 0) return res.redirect(`${pd != '' ? pd[0].web_pay_success_url + '/paymentresponse' : ''}?status=true&transactionId=0`);
        else return res.status(200).send({ message: "Internal server error!", status: false, transactionId: 0 });
        // res.status(500).json({ error: 'Internal server error' });
    }
});





// ============= Payfast Payment ================ //
const qs = require('qs');

router.post("/payfast-payment", async(req, res)=>{
    const {amount, uid, status} = req.body;
    const missingField = await AllFunction.BodyDataCheck(["amount", "uid"], req.body);
    if (missingField.status == false) return res.status(200).json({ message: 'Data Not Found!', status:false});

    try {

        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail WHERE id = '9'`);
        if (payment_detail == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});
        
        let pkey = '';
        try {
            pkey = payment_detail[0].attribute.split(",");
        } catch (error) {
            console.log(error);
            return res.status(200).json({ message: 'Something Went Wrong!', status:false});
        }
        if (pkey == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const admin_data = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${uid}'`);
        if (admin_data == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});
        
        

        const transactionId = `ORDER-${Date.now()}${uid}`;
        // const transactionTag = transactionId + uid; // reused in all URLs

        const baseURL = "https://pittsburgh-volumes-son-ken.trycloudflare.com/customer";

        // status == 0 ? `${req.protocol}://${req.get('host')}/customer/senangpay-success?typecheck=0` : `${req.protocol}://${req.get('host')}/customer/senangpay-success?typecheck=${status || 1}`

        const returnUrl = status == 0 ? `${baseURL}/payfast-success?transactionId=${encodeURIComponent(transactionId)}&status=0` :
                                    `${baseURL}/payfast-success?transactionId=${encodeURIComponent(transactionId)}&status=${encodeURIComponent(status || 1)}`;

        const cancelUrl = status == 0 ? `${baseURL}/payfast-cancel?transactionId=${encodeURIComponent(transactionId)}&status=0` :
                                    `${baseURL}/payfast-cancel?transactionId=${encodeURIComponent(transactionId)}&status=${encodeURIComponent(status || 1)}`;

        const notifyUrl = status == 0 ? `${baseURL}/payfast-notify?transactionId=${encodeURIComponent(transactionId)}&status=0` :
                                    `${baseURL}/payfast-notify?transactionId=${encodeURIComponent(transactionId)}&status=${encodeURIComponent(status || 1)}`;

        const detail = {
            merchant_id: pkey[1],
            merchant_key: pkey[0],
            amount: amount,
            item_name: admin_data[0].name,
            email_address: admin_data[0].email,
            return_url: returnUrl,
            cancel_url: cancelUrl,
            notify_url: notifyUrl,
        };

        console.log(detail);
        
        try {
            console.log(111);
            
            const response = await axios.post('https://sandbox.payfast.co.za/eng/process', qs.stringify(detail), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                maxRedirects: 0, // prevent auto-follow to capture Location header
                validateStatus: (status) => status >= 200 && status < 400 // allow redirect response
            });

            const redirectUrl = response.headers.location;

           
            
            return res.status(200).send({ message: 'SenangPay Payment URL Generate Successful', status: true, payFastLink: redirectUrl });
        } catch (error) {
            console.error("PayFast error:", error.message);
              
            const sandboxBaseUrl = "https://sandbox.senangpay.my/payment/";
            const paymentLink = `${sandboxBaseUrl}?${new URLSearchParams(detail).toString()}`;

            return res.status(200).send({ message: 'SenangPay Payment URL Generate Successful', status: true, payFastLink: paymentLink });
        }

        
    } catch (error) {
        console.error(error);
        const pd = await DataFind(`SELECT * FROM tbl_general_settings`);
        if (typecheck != 0) return res.redirect(`${pd != '' ? pd[0].web_pay_success_url + '/paymentresponse' : ''}?status=true&transactionId=0`);
        else return res.status(200).send({ message: "Internal server error!", status: false, transactionId: 0 });
        // res.status(500).json({ error: 'Internal server error' });
    }
});

router.get("/payfast-success", async(req, res)=>{
    try {
        const { transactionId, status } = req.query;
        // console.log(req.body);
        console.log(req.query);
        console.log("payfast successful");

        // const transactionId = req.query.m_payment_id;
        // console.log(transactionId);
        
        const pd = await DataFind(`SELECT * FROM tbl_general_settings`);
        if (status != 0) return res.redirect(`${pd != '' ? pd[0].web_pay_success_url + '/paymentresponse' : ''}?status=true&transactionId=${transactionId}`);
        else return res.status(200).send({ message: "Payment Successful", status: false, transactionId: transactionId });

        // return res.status(200).send({ message: 'PayFast Payment Successful', status: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get("/payfast-cancel", async(req, res)=>{
    try {
        const { transactionId, status } = req.query;
        // console.log(req.body);
        // console.log(req.query);
        // console.log("payfast cancel");
        
        const pd = await DataFind(`SELECT * FROM tbl_general_settings`);
        if (status != 0) return res.redirect(`${pd != '' ? pd[0].web_pay_success_url + '/paymentresponse' : ''}?status=true&transactionId=0`);
        else return res.status(200).send({ message: "PayFast Payment Failed!!", status: false, transactionId: 0 });

        // return res.status(200).send({ message: 'PayFast Payment Failed!', status: false });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

function flattenToString(obj) {
  const flat = {};
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      flat[key] = obj[key].toString();
    } else {
      flat[key] = obj[key];
    }
  }
  return flat;
}

router.post("/payfast-notify", async (req, res) => {
    try {
        const { transactionId, status } = req.query;

        // console.log("🔔 Received ITN:", req.body);
        // console.log(transactionId);
        const pfData = req.body
        const m_payment_id = pfData.m_payment_id || '';
        const pf_payment_id = pfData.pf_payment_id || '';

        // console.log(m_payment_id);
        // console.log(pf_payment_id);

        if (await DataInsert(`tbl_payfast_transactionids`, `generated_trsansactionid, payfast_transactionid`, `'${transactionId}', '${pf_payment_id}'`, req.hostname, req.protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }

       
    
    } catch (err) {
        console.error("❌ Error handling ITN:", err);
        // res.status(500).send("Internal Server Error");
    }
});

router.post("/get-payfast-transactionid", async (req, res) => {
    try {
        const { transactionId } = req.body;

        const pay_tran = await DataFind(`SELECT * FROM tbl_payfast_transactionids WHERE generated_trsansactionid = '${transactionId}'`);
        console.log(pay_tran);

        if (pay_tran.length > 0) {
            if (await DataDelete(`tbl_payfast_transactionids`, `id = '${pay_tran[0].id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }
        }

        return res.status(200).send({ message: `Transaction ID get ${pay_tran.length > 0 ? 'successfully' : 'unsuccessfully'}`, 
                                        status: pay_tran.length > 0 ? true : false, 
                                        trsansactionId: pay_tran.length > 0 ? pay_tran[0].payfast_transactionid : '' });

    } catch (err) {
        console.error("❌ Error handling ITN:", err);
        res.status(500).send("Internal Server Error");
    }
});






// ============= Midtrans Payment ================ //

const { Snap } = require('midtrans-client');
// const { log } = require("console");

router.post("/midtrans-payment", async(req, res)=>{
    const {amount, uid, status} = req.body;
    const missingField = await AllFunction.BodyDataCheck(["amount", "uid"], req.body);
    if (missingField.status == false) return res.status(200).json({ message: 'Data Not Found!', status:false});

    try {

        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail WHERE id = '10'`);
        if (payment_detail == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});
        
        let pkey = '';
        try {
            pkey = payment_detail[0].attribute.split(",");
        } catch (error) {
            console.log(error);
            return res.status(200).json({ message: 'Something Went Wrong!', status:false});
        }
        if (pkey == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const admin_data = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${uid}'`);
        if (admin_data == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        const snap = new Snap({
            isProduction: false,
            serverKey: pkey[1],
            clientKey: pkey[0]
        });

        let am = parseFloat(amount);
        if (isNaN(am)) {
            return res.status(200).json({ message: 'Invalid amount!', status:false});
        }

        const isInteger = Number.isInteger(am); // Check if the amount is already an integer
        if (!isInteger) {
            am = Math.floor(am);
        }
        
        // Create a transaction
        const transactionDetails = {
            locale: "en",
            transaction_details: {
                order_id: `ORDER-${Date.now()}`,
                gross_amount: am.toString()
            },
            customer_details: {
            first_name: admin_data[0].name,
            email: admin_data[0].email,
            phone: admin_data[0].phone
            },
            credit_card: {
                secure: true
            },
            // finish_payment_return_url: req.protocol + req.hostname + "/api/midtrans-success",
            // error_payment_return_url: req.protocol + req.hostname + "/api/midtrans-cancel"

            finish_payment_return_url: status == 0 ? `${req.protocol}://${req.get('host')}/customer/midtrans-success?status=0` : `${req.protocol}://${req.get('host')}/customer/midtrans-success${status ? `?status=${status}` : ''}`,
            error_payment_return_url: status == 0 ? `${req.protocol}://${req.get('host')}/customer/midtrans-cancel?status=0` : `${req.protocol}://${req.get('host')}/customer/midtrans-cancel${status ? `?status=${status}` : ''}`

            // finish_payment_return_url: LocalURL + "/customer/midtrans-success",
            // error_payment_return_url: LocalURL + "/customer/midtrans-cancel"
        };
        
        snap.createTransaction(transactionDetails)
        .then(transactionToken => {
            return res.status(200).send({ message: 'Midtrans Payment URL Generate Successful', status: true, MidtransURL: transactionToken.redirect_url });
        }).catch(error => {
            console.error("Error creating Midtrans Checkout session:", error.data);
            return res.status(200).send({ message: 'Midtrans Payment URL Not Generated!', status: false });
        });

    } catch (error) {
        console.error(error);
        const pd = await DataFind(`SELECT * FROM tbl_general_settings`);
        if (typecheck != 0) return res.redirect(`${pd != '' ? pd[0].web_pay_success_url + '/paymentresponse' : ''}?status=true&transactionId=0`);
        else return res.status(200).send({ message: "Internal server error", status: true, transactionId: 0 });
        // res.status(500).json({ error: 'Internal server error' });
    }
});

router.get("/midtrans-success", async(req, res)=>{
    const {order_id, status} = req.query;
        // console.log(req.query);
        
    try {
        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail WHERE id = '10'`);
        if (payment_detail == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});
        
        let pkey = '';
        try {
            pkey = payment_detail[0].attribute.split(",");
        } catch (error) {
            console.log(error);
            return res.status(200).json({ message: 'Something Went Wrong!', status:false});
        }
        if (pkey == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});


        const snap = new Snap({
            isProduction: false, // or true for live
            serverKey: pkey[1],
            clientKey: pkey[0]
        });
        
        const transactionStatus = await snap.transaction.status(order_id);
        const transactionId = transactionStatus.transaction_id || order_id;
        // console.log(transactionId);
        // console.log(transactionStatus);

        
        let isSuccess = false;
        // ✅ Handle Credit Card
        if ( transactionStatus.payment_type === 'credit_card' && transactionStatus.transaction_status === 'capture' && transactionStatus.fraud_status === 'accept') {
            isSuccess = true;
        }

        // ✅ Handle all other methods (bank transfer, gopay, qris, etc.)
        if (transactionStatus.transaction_status === 'settlement') {
            isSuccess = true;
        }

        // ✅ Handle if status is already 'success' (for some rare methods)
        if (transactionStatus.transaction_status === 'success') {
            isSuccess = true;
        }

        const pd = await DataFind(`SELECT * FROM tbl_general_settings`);
        if (isSuccess) {
            if (status != 0) return res.redirect(`${pd != '' ? pd[0].web_pay_success_url + '/paymentresponse' : ''}?status=true&transactionId=${transactionId}`);
            else return res.status(200).send({ message: "Payment Successful", status: true, transactionId: transactionId });      
            // res.status(200).json({ status: 'success' });
        } else {
            if (status != 0) return res.redirect(`${pd != '' ? pd[0].web_pay_success_url + '/paymentresponse' : ''}?status=true&transactionId=0`);
            else return res.status(200).send({ message: "Payment was not successful", status: true, transactionId: 0 });
            // res.status(400).json({ status: 'failed', message: 'Payment was not successful' });
        }
    } catch (error) {
        console.error(error);
        const pd = await DataFind(`SELECT * FROM tbl_general_settings`);
        if (status != 0) return res.redirect(`${pd != '' ? pd[0].web_pay_success_url + '/paymentresponse' : ''}?status=true&transactionId=0`);
        else return res.status(200).send({ message: "Internal server error", status: true, transactionId: 0 });
        // res.status(500).json({ error: 'Internal server error' });
    }
});

router.get("/midtrans-cancel", async(req, res)=>{
    const {order_id, status} = req.query;

    try {
        const payment_detail = await DataFind(`SELECT * FROM tbl_payment_detail WHERE id = '10'`);
        if (payment_detail == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});
        
        let pkey = '';
        try {
            pkey = payment_detail[0].attribute.split(",");
        } catch (error) {
            console.log(error);
            return res.status(200).json({ message: 'Something Went Wrong!', status:false});
        }
        if (pkey == "") return res.status(200).json({ message: 'Something Went Wrong!', status:false});

        // const orderId = "ORDER-1715150681164";
        // console.log(orderId);
        // console.log(111);

        const snap = new Snap({
            isProduction: false, // or true for live
            serverKey: pkey[1],
            clientKey: pkey[0]
        });
        
        const transactionStatus = await snap.transaction.status(order_id);
        const transactionId = transactionStatus.transaction_id || order_id;

        const pd = await DataFind(`SELECT * FROM tbl_general_settings`);
        if (transactionStatus.transaction_status === 'settlement') {
            if (status != 0) return res.redirect(`${pd != '' ? pd[0].web_pay_success_url + '/paymentresponse' : ''}?status=true&transactionId=${transactionId}`);
            else return res.status(200).send({ message: "Payment Successful", status: true, transactionId: transactionId });
            // res.status(200).json({ status: 'success' });
        } else {
            if (status != 0) return res.redirect(`${pd != '' ? pd[0].web_pay_success_url + '/paymentresponse' : ''}?status=true&transactionId=0`);
            else return res.status(200).send({ message: "Payment Successful", status: true, transactionId: 0 });
            // res.status(400).json({ status: 'failed', message: 'Payment was not successful' });
        }
    } catch (error) {
        console.error(error);
        const pd = await DataFind(`SELECT * FROM tbl_general_settings`);
        if (status != 0) return res.redirect(`${pd != '' ? pd[0].web_pay_success_url + '/paymentresponse' : ''}?status=true&transactionId=0`);
        else return res.status(200).send({ message: "Payment Successful", status: true, transactionId: 0 });
        // res.status(500).json({ error: 'Internal server error' });
    }
});






module.exports = router;
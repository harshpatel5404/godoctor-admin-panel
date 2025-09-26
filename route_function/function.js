const path = require("path");
const fs = require('fs-extra');
const axios = require('axios');
const { DataFind, DataInsert, DataUpdate, DataDelete } = require("../middleware/database_query");
const ChatFunction = require("../route_function/chat_function");



// ============= Delete Image ================ //

async function otpGenerate(len) {
    const char = '0123456789';
    const charlen = char.length;
    let otp_result = '';
    for (let i = 0; i < len; i++) {
        otp_result += char.charAt(Math.floor(Math.random() * charlen));
    }
    return otp_result;
}

async function BodyDataCheck(bd, reqb) {
    const missingField = bd.filter(field => !reqb[field]);
    if (missingField.length > 0) return {status: false, message: `Something went wrong! Missing required fields: ${missingField.join(', ')}`};
    else return {status: true, message: ``};
}

async function BodyNumberDataCheck(bd, reqb) {
    const missingField = bd.filter(field => !(field in reqb));
    if (missingField.length > 0) return {status: false, message: `Something went wrong! Missing required fields: ${missingField.join(', ')}`};
    else return {status: true, message: ``};
}

async function generateReferralCode(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz';
    const totchars = chars.length;
    let referralCode = '';
    for (let i = 0; i < length; i++) {
        referralCode += chars.charAt(Math.floor(Math.random() * totchars));
    }
    return referralCode;
}

function NotificationDate(ndate) {
    let date = new Date(ndate);
    let day = (date.getDate() < 10 ? '0'+date.getDate() : date.getDate());
    let month = (date.getMonth()+1 < 10 ? '0'+(date.getMonth()+1) : date.getMonth()+1);
    let year = date.getFullYear();
    let hours = (date.getHours() % 12 || 12);
    let minutes = (date.getMinutes() < 10 ? '0'+date.getMinutes() : date.getMinutes());
    let ampm = (date.getHours() >= 12) ? 'PM' : 'AM';
    return `${year}-${month}-${day} | ${hours}:${minutes} ${ampm}`;
}

async function ImageUploadFolderCheck(path) {
    if (!fs.existsSync(path)) {
        fs.mkdirSync(path, { recursive: true });
    }
}



async function DeleteImage(imgpath) {
    if (!imgpath) return true;
    const filePath = path.resolve(__dirname, "../public", imgpath);
    try {
        if (fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath);
            if (stat.isFile()) {
                fs.unlinkSync(filePath);
                console.log('Image deleted successfully.');
                return true;
            } else {
                console.warn('Path exists but is not a file:', filePath);
            }
        } else {
            console.warn('File does not exist:', filePath);
        }
    } catch (error) {
        console.error('Error while deleting image:', error);
        return false;
    }
    return false;
}



function isPointInsidePolygon(point, polygon) {
    let x = point.latitude, y = point.longitiude;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        let xi = polygon[i].latitude, yi = polygon[i].longitiude;
        let xj = polygon[j].latitude, yj = polygon[j].longitiude;

        let intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }

    return inside;
}



function ChecValidEmail(email) { 
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) == false) return false
    return true;
}



// ============= Doctor Review Query ================ //

async function DoctorReviewCalculate(tname) {
    let tot_review = `, COALESCE(COUNT(DISTINCT cr.id), 0) AS tot_review`
    let avgstar = `, CASE 
                        WHEN COUNT(cr.doctor_id) > 0 THEN 
                            CASE
                                WHEN (SUM(cr.star_no) / COUNT(cr.doctor_id)) % 1 >= 0.25 
                                    AND (SUM(cr.star_no) / COUNT(cr.doctor_id)) % 1 < 0.75 
                                THEN ROUND((SUM(cr.star_no) / COUNT(cr.doctor_id)) * 2) / 2
                                ELSE ROUND(SUM(cr.star_no) / COUNT(cr.doctor_id))
                            END
                        ELSE 0 
                    END AS avg_star`;

    let table = `LEFT JOIN tbl_doctor_reviews AS cr ON cr.doctor_id = ${tname}.id`;
    let outtable = `LEFT JOIN tbl_doctor_reviews AS cr ON cr.doctor_id = ${tname}.doctor_id`;
    return { tot_review, avgstar, table, outtable };
}



// ============= Doctor Review Query ================ //

async function LabReviewCalculate(tname) {
    // COUNT(cr.driver_id) AS tot_review
    let tot_review = `, COALESCE(COUNT(DISTINCT cr.id), 0) AS tot_review`
    let avgstar = `, CASE 
                        WHEN COUNT(cr.lab_id) > 0 THEN 
                            CASE
                                WHEN (SUM(cr.star_no) / COUNT(cr.lab_id)) % 1 >= 0.25 
                                    AND (SUM(cr.star_no) / COUNT(cr.lab_id)) % 1 < 0.75 
                                THEN ROUND((SUM(cr.star_no) / COUNT(cr.lab_id)) * 2) / 2
                                ELSE ROUND(SUM(cr.star_no) / COUNT(cr.lab_id))
                            END
                        ELSE 0 
                    END AS avg_star`;

    let table = `LEFT JOIN tbl_lab_reviews AS cr ON cr.lab_id = ${tname}.id`;
    let outtable = `LEFT JOIN tbl_lab_reviews AS cr ON cr.lab_id = ${tname}.lab_id`;
    return { tot_review, avgstar, table, outtable };
}



// ============= Doctor Signup check ================ //

async function DoctorSignupCheck(d) {
    let status = 0;
    
    if (d.country_code == '' || d.phone == '' || d.password == '') status = 1
    else if (d.logo == '' || d.cover_logo == '' || d.name == '' || d.email == '' || d.title == '' || d.subtitle == '' || d.year_of_experience == 0 || d.tag == '' || d.description == '' || d.cancel_policy == '') status = 2
    else if (d.address == '' || d.pincode == '' || d.landmark == '' || d.latitude == 0 || d.longitude == 0) status = 3
    else status = 0

    return status;
}



// ============= Two Distance calculate ================ //

async function GetDistance(pickup, drop, google_map_key) {
    const apiKey = google_map_key;
    const origin = pickup; // Origin
    const destination = drop; // Destination

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?units=metric&origins=${origin}&destinations=${destination}&key=${apiKey}`;

    try {
        const response = await axios.get(url);
        const data = await response.data;
        
        if (data.status === 'OK' && data.rows && data.rows.length > 0 && data.rows[0].elements && data.rows[0].elements.length > 0) {
            const element = data.rows[0].elements[0];
            if (element.status === 'OK') {
                
                const distance = element.distance.text;
                const duration = element.duration.text;
                let dspl = distance.split(" "), kmcal = 0;
                
                if (dspl[1].match("km", "i") == null) kmcal = (Number(dspl[0]) / 1000).toFixed(2);
                else kmcal = Number(Number(dspl[0]).toFixed(2));

                return { status: 1, dis:Number(kmcal), dur:duration}
            } else {
                console.log(element.status);
                
                console.log('Error in fetching data:', element.status);
                return { status: 0, dis:0, dur:"0 min"};
            }
        } else {
            console.log('Distance calculate, Invalid response structure or status:', data.status);
            return { status: 0, dis:0, dur:"0 min"};
        }
    } catch (error) {
        console.error('Distance calculate, Error fetching the distance:', error);
        return { status: 0, dis:0, dur:"0 min"};
    }
}



async function generateAndSplitTimeSlots(breakDuration) {
    let morning = [], afternoon = [], evening = [], count = 0, start = new Date();

    start.setHours(0, 0, 0, 0);
    const MAX_ITERATIONS = Math.floor(1440 / breakDuration);
    
    while (start.getHours() < 24) {
        count++;
        if (count > MAX_ITERATIONS) break;
        
        let formatTime = (date) => {
            let hours = date.getHours();
            let minutes = date.getMinutes();
            let ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12 || 12;
            return `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
        };
        
        let formattedTime = formatTime(start), hour = start.getHours();
        
        if (hour >= 6 && hour < 12) {
            morning.push(formattedTime);
        } else if (hour >= 12 && hour < 18) {
            afternoon.push(formattedTime);
        } else if (hour >= 18 && hour < 24) {
            evening.push(formattedTime);
        }

        start.setMinutes(start.getMinutes() + breakDuration);
    }

    return { morning, afternoon, evening };
}

async function AddMinutesToTime(time, minutesToAdd) {
    let [timePart, modifier] = time.split(" ");
    let [hours, minutes] = timePart.split(":").map(Number);

    if (modifier === "PM" && hours !== 12) hours += 12;
    if (modifier === "AM" && hours === 12) hours = 0;

    let date = new Date();
    date.setHours(hours, minutes + minutesToAdd);

    let newHours = date.getHours(), newMinutes = date.getMinutes();
    
    let newModifier = newHours >= 12 ? "PM" : "AM";
    if (newHours > 12) newHours -= 12;
    if (newHours === 0) newHours = 12;

    return `${newHours}:${newMinutes.toString().padStart(2, "0")} ${newModifier}`;
}


const AllDayList = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

async function parseTime(timeStr) {
    let [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    
    if (modifier === 'PM' && hours !== 12) {
        hours += 12;
    }
    if (modifier === 'AM' && hours === 12) {
        hours = 0;
    }

    return { hours, minutes };
}

async function getScheduleList(schedule, bookedSchedule, timeSlots, date) {
    let list = [];
    let scheduleMap = new Map(schedule.map(item => [item.t, item]));
    let bookedMap = new Set(bookedSchedule.map(item => item.t));

    let now = new Date();
    let currentDate = now.toISOString().split('T')[0];
    let currentHours = now.getHours();
    let currentMinutes = now.getMinutes();
    
    for (let val of timeSlots) {
        let dc = 1;
        if (date == currentDate) {
            let { hours, minutes } = await parseTime(val)
            if (hours > currentHours || (hours === currentHours && minutes > currentMinutes)) dc = 1;
            else dc = 0;
        }

        if (dc == 1) {
            let hidItem = scheduleMap.get(val);
            list.push({
                t: val, o: hidItem ? (bookedMap.has(val) ? 2 : 1) : 0, hid: hidItem ? hidItem.hid : ''
            });
        }
    };

    return list;
}


async function TimeDurationWebSlot(dhd_list, remove_id, time_data, morning, afternoon, evening, daystatus) {

    const mergedSchedule = {}, merbookSche = {};
    let ndatelist = [];

    dhd_list.forEach(row => {
        if (row.hospital_id != remove_id) {
            const dateTimeList = row.date_time_list;
        
            dateTimeList.forEach(dayObject => {
                const day = Object.keys(dayObject)[0];
                const sessions = dayObject[day];
                
                if (!mergedSchedule[day]) {
                    mergedSchedule[day] = { Morning: [], Afternoon: [], Evening: [] };
                }
                
                Object.keys(sessions).forEach(session => {
                    mergedSchedule[day][session] = [
                        ...new Set([...mergedSchedule[day][session], ...sessions[session]])
                    ];
                });
            });
        }
    });
    
    let adl = daystatus != '' ? [daystatus] : AllDayList
    
    adl.forEach((dval, di) => {
        let daySchedule = mergedSchedule[dval] || { Morning: [], Afternoon: [], Evening: [] };
        let timeDataDay = time_data[0]?.date_time_list?.[AllDayList.indexOf(dval)]?.[dval] || { Morning: [], Afternoon: [], Evening: [] };
    
        const processTimeList = (timeList, timeData, mergedData) => {
            return timeList.map(mval => ({
                t: mval, s: timeData.includes(mval) ? 1 : 0, o: mergedData.includes(mval) ? 1 : 0
            }));
        };
        ndatelist.push({
            [dval]: {
                "Morning": processTimeList(morning, timeDataDay.Morning, daySchedule.Morning),
                "Afternoon": processTimeList(afternoon, timeDataDay.Afternoon, daySchedule.Afternoon),
                "Evening": processTimeList(evening, timeDataDay.Evening, daySchedule.Evening)
            }
        });
    });
    
    return ndatelist;
}

async function TimeDurationApiSlot(dhd_list, morning, afternoon, evening, mdate, remhos) {
    const mergedSchedule = {}, merbookSche = {};

    dhd_list.forEach(row => {
        let inhc = remhos.length > 0 ? remhos.includes(Number(row.hospital_id)) : false;

        if (inhc === false) {
            const scheduleLists = [
                { list: row.date_time_list, target: mergedSchedule },
                { list: row.book_time_list, target: merbookSche }
            ];

            scheduleLists.forEach(({ list, target }) => {
                if (!Array.isArray(list)) return; // ✅ Ensure list is array

                list.forEach(dayObject => {
                    const day = Object.keys(dayObject)[0];
                    const sessions = dayObject[day];

                    if (!target[day]) {
                        target[day] = { Morning: [], Afternoon: [], Evening: [] };
                    }

                    Object.keys(sessions).forEach(session => {
                        const newSlots = sessions[session].map(time => ({ t: time, hid: row.hospital_id }));

                        const existingSlots = target[day][session];
                        const mergedSlots = [...existingSlots, ...newSlots];

                        // Remove duplicates
                        const uniqueSlots = [];
                        const seenTimes = new Set();

                        mergedSlots.forEach(slot => {
                            if (!seenTimes.has(slot.t)) {
                                uniqueSlots.push(slot);
                                seenTimes.add(slot.t);
                            }
                        });

                        target[day][session] = uniqueSlots;
                    });
                });
            });
        }
    });

    let date = 0, cdate = new Date(), alldate = [], ndatelist = [], first = [];

    if (mdate == 0) {
        date = new Date().getDay();

        const general_setting = await DataFind(`SELECT tot_book_appo_date FROM tbl_general_settings`);
        let daycount = date, tot_day = date + general_setting[0].tot_book_appo_date;

        for (let i = date; i < tot_day;) {
            let ndate = cdate.toISOString().split("T")[0], nd = '';
            new Date(cdate.setDate(cdate.getDate() + 1));

            if (AllDayList[daycount]) {
                nd = AllDayList[daycount];
                daycount++;
            } else {
                nd = AllDayList[0];
                daycount = 1;
            }

            if (i == date) first.push({ nd, ndate });
            alldate.push({ date: ndate, week_day: nd, avai_slot: 0 });

            i++;
        }
    } else {
        date = new Date(mdate).getDay();
        cdate = new Date(mdate).toISOString().split("T")[0];
        let nd = AllDayList[date];
        first.push({ nd, ndate: mdate });
    }

    if (first.length > 0) {
        const { nd, ndate } = first[0];

        let mc = mergedSchedule[nd]?.Morning || [],
            mbc = merbookSche[ndate]?.Morning || [],
            ac = mergedSchedule[nd]?.Afternoon || [],
            abc = merbookSche[ndate]?.Afternoon || [],
            ec = mergedSchedule[nd]?.Evening || [],
            ebc = merbookSche[ndate]?.Evening || [];

        const mclist = await getScheduleList(mc, mbc, morning, ndate);
        const aclist = await getScheduleList(ac, abc, afternoon, ndate);
        const eclist = await getScheduleList(ec, ebc, evening, ndate);

        ndatelist.push({
            date: ndate,
            week_day: nd,
            avai_slot: 0,
            Morning: mclist,
            Afternoon: aclist,
            Evening: eclist
        });
    }

    return { alldate, ndatelist };
}


async function CurrentMaxBookDate() {
    let date = new Date().getDay(), cdate = new Date(), alldate = [], first = [];

    const general_setting = await DataFind(`SELECT tot_book_appo_date FROM tbl_general_settings`);
    let daycount = date, tot_day = date + general_setting[0].tot_book_appo_date;

    for (let i = date; i < tot_day;) {
        let ndate = cdate.toISOString().split("T")[0], nd = '';
        new Date(cdate.setDate(cdate.getDate()+1));
        
        if (AllDayList[daycount]) {
            nd = AllDayList[daycount];
            daycount++;
        } else {
            nd = AllDayList[0];
            daycount = 1;
        }

        if (i == date) first.push({nd, ndate});
        alldate.push({ date: ndate, week_day: nd, avai_slot: 0 });

        i++;
    }
    return alldate;
}

async function AppointmentStatus(status) {
    if (status == 1) return 'Your appointment is pending.'
    else if (status == 2) return 'Your treatment is starting.'
    else if (status == 3) return 'Your treatment is over.'
    else if (status == 4) return 'Your treatment is complete.'
    else if (status == 5) return 'Your appointment has been canceled.'
    else return 'Something went wrong'
}

async function TwoTimeDiference(ntime, oldtime) {
    let currentTime = new Date(ntime);
    let OldTime = new Date(oldtime);

    let timeDifference = currentTime - OldTime;

    let differenceInSeconds = Math.floor(timeDifference / 1000);
    let differenceInMinutes = Math.floor(differenceInSeconds / 60);

    let hour = Math.floor(differenceInMinutes / 60);
    let minute = differenceInMinutes % 60;
    let second = differenceInSeconds % 60;

    return { hour, minute, second }
}



async function BookingDateCheck( id, d_id, wallet_amount, hospital_id, department_id, date, date_type, time ) {

    const ndate = new Date(date), today = new Date();
    today.setHours(0, 0, 0, 0);
    const [year, month, day] = date.split("-").map(Number);
    const validDate = new Date(year, month - 1, day);
    const isDateCorrect = validDate.getFullYear() === year && validDate.getMonth() + 1 === month && validDate.getDate() === day;
    if(!isDateCorrect || isNaN(ndate.getTime()) || ndate < today) return 1;
    
    const customer = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${id}' AND status = '1'`);
    if (customer == "") return 2;

    if (Number(wallet_amount) > customer[0].tot_balance) 3;
    
    const dhd_list = await DataFind(`SELECT dhd.hospital_id, COALESCE(dep.name, '') AS department_name, COALESCE(doc.name, '') AS dname, COALESCE(hos.name, '') AS hospital_name, 
                                    COALESCE(dhd.sub_title, '') AS sub_title

                                    FROM tbl_doctor_hos_depart_list AS dhd
                                    LEFT JOIN tbl_doctor_list AS doc ON doc.id = '${d_id}' AND doc.status = '1'
                                    LEFT JOIN tbl_hospital_list AS hos ON hos.id = '${hospital_id}' AND hos.status = '1'
                                    LEFT JOIN tbl_department_list AS dep ON dep.id = dhd.department_id

                                    WHERE dhd.hospital_id = '${hospital_id}' AND dhd.department_id = '${department_id}' AND dhd.status = '1'
                                    GROUP BY dhd.hospital_id, dhd.sub_title, dep.name;`);

    if (dhd_list == '') return 4;
    
    const dhd = await DataFind(`SELECT dht.id AS dt_id, CAST(hos.id AS CHAR) AS hospital_id, COALESCE(hos.name, '') AS hospital_name, 
                                dht.date_time_list, dht.book_time_list
                                FROM tbl_doctor_hos_time AS dht
                                LEFT JOIN tbl_hospital_list AS hos ON hos.id = dht.hospital_id
                                WHERE dht.doctor_id = '${d_id}' AND dht.hospital_id = '${hospital_id}'`);

    if (dhd == '') return 5;

    dhd[0].date_time_list = typeof dhd[0].date_time_list == "string" ? JSON.parse(dhd[0].date_time_list) : dhd[0].date_time_list;
    dhd[0].book_time_list = typeof dhd[0].book_time_list == "string" ? JSON.parse(dhd[0].book_time_list) : dhd[0].book_time_list;

    let date_day = new Date(date), daytype = await AllFunction.AllDayList[date_day.getDay()], book_date = new Date();
    
    

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
        
        
        if (!check_d) return 6;

    } else return 7;



    // check date and time is already book time match and not match to add
    let match = dhd[0].book_time_list.find(item => item[date]);
    if (match) {
        if (match[date][date_type]) {
            
            let bookd = match[date][date_type];
            const check_d = new Set(bookd.map(item => item)).has(time);
            if(check_d) return 8;
            bookd.push(time);

          
        } else {
            match[date][date_type] = match[date][date_type] ?? [];
            match[date][date_type].push(time);
        }
    } else dhd[0].book_time_list.push({ [date]: { [date_type]: [time] } });

    return { dhd, dhd_list, customer }
}



async function webDoctorOrder(uid, hostname, protocol, cusd, dhdl, bad, transactionId) {
    const ba = bad.length == 0 ? await DataFind(`SELECT * FROM tbl_booked_appointment_cart WHERE customer_id = '${uid}'`) : bad;
    
    try {
        if (ba != '') {
            let b = ba[0], customer = cusd, dhd_list = dhdl, bdate = new Date();
    
            if (customer.length == 0) customer = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${b.customer_id}' AND status = '1'`);
            if (customer == "") return { Result:false, message: 'User not found!', id: 0 };
    
            if (dhd_list.length == 0) dhd_list = await DataFind(`SELECT dhd.hospital_id, COALESCE(dep.name, '') AS department_name, COALESCE(doc.name, '') AS dname, 
                                                                COALESCE(hos.name, '') AS hospital_name, COALESCE(dhd.sub_title, '') AS sub_title
    
                                                                FROM tbl_doctor_hos_depart_list AS dhd
                                                                LEFT JOIN tbl_doctor_list AS doc ON doc.id = ${b.doctor_id} AND doc.status = '1'
                                                                LEFT JOIN tbl_hospital_list AS hos ON hos.id = ${b.hospital_id} AND hos.status = '1'
                                                                LEFT JOIN tbl_department_list AS dep ON dep.id = dhd.department_id
    
                                                                WHERE dhd.hospital_id = '${b.hospital_id}' AND dhd.department_id = '${b.department_id}' AND dhd.status = '1'
                                                                GROUP BY dhd.hospital_id, dhd.sub_title, dep.name;`);
            
            if (dhd_list == '') return { Result:false, message: 'Data not found!', id: 0 };
    
            const bookapp = await DataInsert(`tbl_booked_appointment`, `customer_id, doctor_id, hospital_id, department_id, sub_depar_id, status, book_date, appointment_date, 
                appointment_time, date_type, family_mem_id, show_type, show_type_price, tot_price, paid_amount, additional_price, coupon_id, coupon_amount, doctor_commission, 
                site_commisiion, payment_id, wallet_amount, additional_note, otp, treatment_time, patient_health_concerns, vitals_physical, drugs_prescription, diagnosis_test,
                cancel_id, cancel_reason, transactionId`,
                `'${b.customer_id}', '${b.doctor_id}', '${b.hospital_id}', '${b.department_id}', '${b.sub_depar_id}', '1', '${bdate.toISOString()}', '${b.appointment_date}', 
                '${b.appointment_time}', '${b.date_type}', '${b.family_mem_id}', '${b.show_type}', '${b.show_type_price}', '${b.tot_price}', '${b.paid_amount}', 
                '${b.additional_price}', '${b.coupon_id}', '${b.coupon_amount}', '${b.doctor_commission}', '${b.site_commisiion}', '${b.payment_id}', '${b.wallet_amount}', 
                '${b.additional_note}', '${await AllFunction.otpGenerate(4)}', '{}', '[]', '[]', '[]', '[]', '', '', '${transactionId}'`, hostname, protocol);
            
            if (bookapp == -1) return { Result:false, message: process.env.dataerror, id: 0 };
        
            if (b.wallet_amount > 0) {
                const tot_amount = customer[0].tot_balance - Number(b.wallet_amount);
        
                if (await DataUpdate(`tbl_customer`, `tot_balance = '${tot_amount}'`, `id = '${customer[0].id}'`, hostname, protocol) == -1) {
                    return { Result:false, message: process.env.dataerror, id: 0 };
                }
        
                if (await DataInsert(`tbl_customer_wallet`, `customer_id, amount, date, payment_type, status, amount_type`,
                    `'${b.customer_id}', '${b.wallet_amount}', '${new Date().toISOString().split("T")[0]}', '0', '2', '${bookapp.insertId}'`, hostname, protocol) == -1) {
                    return { Result:false, message: process.env.dataerror, id: 0 };
                }
            }
            
            let appointin = 'Appointment ID:- #'+ bookapp.insertId +'\n\n'+
                            'Doctor name:- '+ dhd_list[0].dname +'\n\n'+
                            'Hospital:- '+ dhd_list[0].hospital_name +'\n'+
                            'Department:- '+ dhd_list[0].department_name +'\n'+
                            'Department type:- '+ dhd_list[0].sub_title +'\n\n'+
                            'Book date:- '+ bdate.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', 
                                            minute: 'numeric', second: 'numeric', hour12: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }) +'\n'+
                            'Appontment date:- '+ b.date +'\n'+
                            'Appontment time:- '+ b.time +'\n\n'+
                            'Appontment type:- '+ `${b.show_type == '1' ? "In person" : "Video visit"}` +'\n'+
                            'Payment status:- '+ `${b.tot_price == b.paid_amount ? "Paid" : "Unpaid"}` +'';
                     
            const chat = await ChatFunction.Chat_Save(b.doctor_id, b.doctor_id, b.customer_id, appointin, 'doctor', hostname, protocol);
            if (chat == 1) return { Result:false, message: 'Something went wrong!', id: 0 };
            if (chat == 2) return { Result:false, message: process.env.dataerror, id: 0 };
            
            if (await DataDelete(`tbl_booked_appointment_cart`, `customer_id = '${customer[0].id}'`, hostname, protocol) == -1) {
                return { Result:false, message: process.env.dataerror, id: 0 };
            }
    
            if (await DataInsert(`tbl_notification`, `order_id, customer_id, service_user_id, date, mstatus, ostatus, notification`,
                `'${bookapp.insertId}', '${b.customer_id}', '${b.doctor_id}', '${AllFunction.NotificationDate(bdate)}', '1', '1', 
                'ðŸ•’ Your doctor appointment request has been received and is pending confirmation. Appointment ID : # ${bookapp.insertId}'`, hostname, protocol) == -1) {
                return { Result:false, message: process.env.dataerror, id: 0 };
            }
    
            sendOneNotification(`ðŸ•’ Your doctor appointment request has been received and is pending confirmation. Appointment ID : # ${bookapp.insertId}`, 'customer', b.customer_id, 1);
            sendOneNotification(`ðŸ•’ Your doctor appointment request has been received and is pending confirmation. Appointment ID : # ${bookapp.insertId}`, 'customer', b.customer_id, 2);
            sendOneNotification(`Received new appointment. Appointment ID : # ${bookapp.insertId}`, 'doctor', b.doctor_id, 1);
            
            return { Result: true, message: 'Payment Successful', id: bookapp.insertId };
    
           
        }
        await RefundDbookingPayment(uid, hostname, protocol);
    
        return { Result: false, id: 0 };
        
    } catch (error) {
        await RefundDbookingPayment(uid, hostname, protocol);
        return { Result: false, id: 0 };
    }
}



async function RefundDbookingPayment(uid, bookapp, paid_amount, datec, payment_id, hostname, protocol) {
    
    
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
            `'${cus[0].id}', '${paid_amount}', '${new Date().toISOString().split("T")[0]}', '0', '1', '${payment_id}'`, hostname, protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }
    }
    
    if (bookapp != 0) {
        // console.log(333);
        if (await DataDelete(`tbl_booked_appointment`, `id = '${bookapp.insertId}'`, hostname, protocol) == -1) {
            return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
        }
    }

    return true;
}

async function SetReferralAmount(pending_ref, customer_id, tot_balance) {
    if (pending_ref != '') {
        const rc  = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${pending_ref}'`);
        const gd  = await DataFind(`SELECT * FROM tbl_general_settings`);
        if (rc != '' && gd != '') {
            let wamount = Number(rc[0].tot_balance) + Number(gd[0].signup_credit), date = new Date().toISOString().split("T")[0];
            if (await DataUpdate(`tbl_customer`, `tot_balance = '${wamount}'`, `id = '${rc[0].id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }

            if (await DataInsert(`tbl_customer_wallet`, `customer_id, amount, date, payment_type, status, amount_type`,
                `'${rc[0].id}', '${gd[0].signup_credit}', '${date}', '0', '8', ''`, req.hostname, req.protocol) == -1) { 
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }

            let cfream = Number(tot_balance) + Number(gd[0].refer_credit);
            if (await DataUpdate(`tbl_customer`, `tot_balance = '${cfream}', pending_ref = ''`, `id = '${customer_id}'`, req.hostname, req.protocol) == -1) {
                return res.status(200).json({ ResponseCode: 401, Result:false, message: process.env.dataerror });
            }

            if (await DataInsert(`tbl_customer_wallet`, `customer_id, amount, date, payment_type, status, amount_type`,
                `'${customer_id}', '${gd[0].refer_credit}', '${date}', '0', '8', ''`, req.hostname, req.protocol) == -1) { 
                req.flash('errors', process.env.dataerror);
                return res.redirect("/valid_license");
            }
        }
    }
}


// ============= Convert Day  ================ //

async function DateConvertDay(walletd) {
    const all_data = [];
    walletd.forEach(item => {
        const dateString = new Date(item.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        
        let existingDateEntry = all_data.find(entry => entry.date === dateString);
        
        if (!existingDateEntry) {
            existingDateEntry = {
                date: dateString,
                detail: []
            };
            all_data.push(existingDateEntry);
        }
        item.date = new Date(item.date).toISOString().split("T")[0];
        existingDateEntry.detail.push(item);
    });
    return all_data
}



const AllFunction = { DeleteImage, otpGenerate, generateAndSplitTimeSlots, TimeDurationWebSlot, AllDayList, GetDistance, isPointInsidePolygon, DoctorReviewCalculate, 
                    TimeDurationApiSlot, AppointmentStatus, AddMinutesToTime, DoctorSignupCheck, TwoTimeDiference, ChecValidEmail, DateConvertDay, LabReviewCalculate, BookingDateCheck,
                    webDoctorOrder, RefundDbookingPayment, ImageUploadFolderCheck, generateReferralCode, SetReferralAmount, BodyDataCheck, BodyNumberDataCheck, NotificationDate,
                    CurrentMaxBookDate };

module.exports = AllFunction;

function get24HoursTime() {
    let currentDateValue = new Date();
    currentDateValue = currentDateValue.setDate(currentDateValue.getDate() - 1);
    return new Date(currentDateValue);

}

function getUTCDate (dateField){
    let convertedDate = new Date(dateField);
    convertedDate = new Date(convertedDate.getTime() - (convertedDate.getTimezoneOffset() * 60000));
    return new Date(convertedDate);
}
module.exports = {
    get24HoursTime,
    getUTCDate,
};

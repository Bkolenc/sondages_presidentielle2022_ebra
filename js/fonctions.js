
function getUrlDomain(){

    const getUrlParams = (key)=> {
        let params = new URLSearchParams(window.location.search);
        return params.get(key);
    }

    const convertDate = (string) => {
        const dateRegex=/(202[0-9])-([0-9]{1,2})-([0-9]{1,2})/;
        if (!string) return null;
        else {
            let matches=dateRegex.exec(string).map((d)=>parseInt(d));
            return new Date(matches[1],matches[2]-1,matches[3]);
        }
    }

    let today=new Date(),
        begin=convertDate( getUrlParams('debut')),
        end=convertDate( getUrlParams('fin')),
        interval= getUrlParams('duree'); //en jours

    if (interval && end && !begin) begin=new Date(end.getFullYear(),end.getMonth(),end.getDate()-interval);
    else if (interval && !end && !begin) {
        begin=new Date(today.getFullYear(),today.getMonth(),today.getDate()-interval);
        end=today;
    }

    return {begin:begin, end:end};



}


//______________________________________
// INARRAY
// Détecte si une chaîne de caractères est inclus dans un tableau
// - needle = la chaîne de caractère
// - haystack = le tableau
function inArray(needle,haystack)
{
    var count=haystack.length;
    for(var i=0;i<count;i++)
    {
        if(haystack[i]===needle){return true;}
    }
    return false;
}

function hexToRgb(hex) {
    if(hex != undefined)
    {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
    else
    {
        return { r:0, g:0, b:0}
    }

}

function recup_initiales(candidat)
{
    var candidat = candidat.replace(/-/g, " ");
    var split = candidat.split(" ");
    var initiales = "";
    split.forEach(function(v, k){
        initiales += v[0];
    });
    return initiales
}


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

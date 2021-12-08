/**
 * Recupère les paramètres de l'url
 * @param key
 * @returns {string|number[]|Date}
 */
function getUrlParams (key){
    const params = new URLSearchParams(window.location.search);
    const dateRegex=/(202[0-9])-([0-9]{1,2})-([0-9]{1,2})/;
    const convertDate = function (string) {
        if (!string) return null;
        else {
            let matches=dateRegex.exec(string).map((d)=>parseInt(d));
            return new Date(matches[1],matches[2]-1,matches[3]);
        }
    }
    switch (key) {
        case 'begin':
        case 'end': return convertDate(params.get(key));
                    break;
       // case 'candidats':  return params.get(key).split(',').map(d=>parseInt(d));
        default: return params.get(key);
    }
}
function getUrlParams (key){
    const params = new URLSearchParams(window.location.search);
    console.log(params.get(key));
    switch (key) {
        case 'begin':
        case 'end': let parts=params.get(key).split('-');
                    return new Date(parts[0], parts[1] - 1, parts[2]);
        case 'candidats':  return params.get(key).split(',').map(d=>parseInt(d));
        default: return params.get(key);
    }
}
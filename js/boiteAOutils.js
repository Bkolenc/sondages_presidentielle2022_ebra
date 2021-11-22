//____________________________________________________________________
// DETECT DRAG
// Détecte si on essaie de drag un élément vers la gauche ou la droite
// - containerMobile : L'élément sur lequel on doit swipe sur mobile
// - containerDesktop : l'élément sur lequel on doit swipe sur desktop
// - index : l'index (à déclarer en variable globale) à faire évoluer
// - max : l'index max
function detectDrag(containerMobile, containerDesktop, index, max)
{
    detectDragMobile(containerMobile, containerDesktop, index, max);
    detectDragDesktop(containerMobile, containerDesktop, index, max);
}


function detectDragMobile(containerMobile, containerDesktop, index, max)
{
    $(containerMobile).off("touchend").off("touchstart");
    $(containerMobile).on("touchstart", function(e){
        $(containerMobile).on("touchend", function(i){
            var Xstart=e.originalEvent.touches[0].pageX;
            var Xend=i.originalEvent.changedTouches[0].pageX;
            var diff=Xstart-Xend;
            var docWidth=$(document).width();
            
            if(Math.abs(diff)/docWidth > 0.10)
            {
                    if(diff>0 && index<max)
                        {
                            index++;
                        }
                    if(diff<0 && index>0)
                        {
                            index--;
                        }
            }
            detectDragMobile(containerMobile, containerDesktop, index, max);
            detectDragDesktop(containerMobile, containerDesktop, index, max);
            console.log("index : "+index);
        });
    });
}
function detectDragDesktop(containerMobile, containerDesktop, index, max)
{
    $(containerDesktop).off("mousedown").off("mouseup");
    $(containerDesktop).on("mousedown", function(e){
        $(containerDesktop).on("mouseup", function(i){
            var Xstart=e.pageX;
            var Xend=i.pageX;
            var diff=Xstart-Xend;
            var docWidth=$(document).width();

            if(Math.abs(diff)/docWidth > 0.10)
            {
                if(diff>0 && index<max)
                {
                    index++;
                }
                if(diff<0 && index>0)
                {
                    index--;
                }
            }
            detectDragMobile(containerMobile, containerDesktop, index, max);
            detectDragDesktop(containerMobile, containerDesktop, index, max);
            console.log("index : "+index);
        });
    });
}

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

//_____________________________________________________
// DOWNLOAD
// Permet de télécharger sur ordinateur un objet json
// - data : le tableau json
// - filename : le nom du futur fichier
// - type : le type du fichier
function download(data, filename, type) {
    var file = new Blob([JSON.stringify(data)], {type: type});
    if (window.navigator.msSaveOrOpenBlob) // IE10+
        window.navigator.msSaveOrOpenBlob(file, filename);
    else { // Others
        var a = document.createElement("a"),
            url = URL.createObjectURL(file);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);  
        }, 0); 
    }
}


function get_csv(url, delimiter, callback)
{
    $.ajax({
        type: "GET",
        url: url,
        dataType: "text",
        async:true,
        success: function(data){
            
            var array = CSVToArray( data, delimiter);
            var object = [];
            
            var headers = array[0];
            $.each(array, function(k, v){
                
                if(k>0 && v.length == headers.length)
                {
                    var aPush = {};
                    $.each(v, function(kk, vv){
                        aPush[headers[kk]] = vv; 
                    });
                    object.push(aPush);
                }
                else if(v.length > headers.length)
                {
                    console.log("problème probable de délimiteur");
                    console.log(v);
                }
            });
            callback(object);
            }
            
            
            
            
            
            
     });
}

function CSVToArray( strData, strDelimiter ){
    
    
	// Check to see if the delimiter is defined. If not,
	// then default to comma.
	strDelimiter = (strDelimiter || ",");

	// Create a regular expression to parse the CSV values.
	var objPattern = new RegExp(
		(
			// Delimiters.
			"(\\" + strDelimiter + "|\\r?\\n|\\r|^)" +

			// Quoted fields.
			"(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +

			// Standard fields.
			"([^\"\\" + strDelimiter + "\\r\\n]*))"
		),
		"gi"
		);


	// Create an array to hold our data. Give the array
	// a default empty first row.
	var arrData = [[]];

	// Create an array to hold our individual pattern
	// matching groups.
	var arrMatches = null;


	// Keep looping over the regular expression matches
	// until we can no longer find a match.
	while (arrMatches = objPattern.exec( strData )){

		// Get the delimiter that was found.
		var strMatchedDelimiter = arrMatches[ 1 ];

		// Check to see if the given delimiter has a length
		// (is not the start of string) and if it matches
		// field delimiter. If id does not, then we know
		// that this delimiter is a row delimiter.
		if (
			strMatchedDelimiter.length &&
			(strMatchedDelimiter != strDelimiter)
			){

			// Since we have reached a new row of data,
			// add an empty row to our data array.
			arrData.push( [] );

		}


		// Now that we have our delimiter out of the way,
		// let's check to see which kind of value we
		// captured (quoted or unquoted).
		if (arrMatches[ 2 ]){

			// We found a quoted value. When we capture
			// this value, unescape any double quotes.
			var strMatchedValue = arrMatches[ 2 ].replace(
				new RegExp( "\"\"", "g" ),
				"\""
				);

		} else {

			// We found a non-quoted value.
			var strMatchedValue = arrMatches[ 3 ];

		}


		// Now that we have our value string, let's add
		// it to the data array.
		arrData[ arrData.length - 1 ].push( strMatchedValue );
	}
    var integrity = true;
    var length = arrData[0].length;
    
    if(length <= 1)
    {
        integrity = false;
    }
    else
    {
        $.each(arrData, function(k, v){
            if(v.length != length && (v[0] != "" && v.length > 1))
            {
                integrity = false;
                
            }
        });
    }
    
    if(integrity)
    {
        delimiterIndex = 0;
        return( arrData );
    }
    else
    {
        delimiterIndex++;
        
        if(delimiterIndex <= (possibleDelimiters.length +1) )
        {
            var toReturn = CSVToArray(strData, possibleDelimiters[delimiterIndex]);
            return toReturn;
        }
        
    }

	// Return the parsed data.
	
}

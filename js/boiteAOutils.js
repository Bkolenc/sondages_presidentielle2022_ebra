
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


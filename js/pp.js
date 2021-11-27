document.addEventListener("DOMContentLoaded", function(event) {
    recup_csv_tour1(function(){ // Fonction Async, attention
        //Formatage pour écrire les dates en français
        const localeFr= {
            "dateTime": "%A, le %e %B %Y, %X",
            "date": "%d/%m/%Y",
            "time": "%H:%M:%S",
            "periods": ["AM", "PM"],
            "days": ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"],
            "shortDays": ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."],
            "months": ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
            "shortMonths": ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]};
        d3.timeFormatDefaultLocale(localeFr);

        // On formate les données :
        formater_donnees();


        // On sélectionne les candidats s'affichant par défaut en fixant un seuil (en pourcent)
        candidats_par_defaut(G_sondages.vrac.seuil);
        afficher_boutons_candidats();
        // Voici à quoi ressemblent maintenant les données brutes pour former les courbes :



        //Reformatage des données et injection dans la classe Poll
        console.log(G_sondages);


        let dictToMap = (dict) => {
            let myMap=new Map();
            Object.keys(dict)
                    .forEach( (key) => myMap.set( parseInt(key.replace('id_','')) , dict[key] )   );
            return myMap;
        };

        const MainData=new DataWrapper('mainData')
                            .push(G_sondages.tables.resultats_1)
                            .map(d3.autoType),
                Graph=new Poll('motherOfPolls')
                    .push('resultats',MainData)
                    .push( 'candidats',dictToMap(G_sondages.tables.candidats))
                    .push( 'couleurs',dictToMap(G_sondages.couleurs))
                    .draw();
        console.log(Graph,MainData);


            // Tests pour afficher toutes les infos relatives à un point :
//    var point_1 = G_sondages.courbe_par_candidat["id_3"][4],
//        point_2 = G_sondages.courbe_par_candidat["id_16"][32];
//    console.log(completer_point("id_3", point_1));
//    console.log(completer_point("id_16", point_2));
            });
});


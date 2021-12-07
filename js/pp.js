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
        candidats_par_defaut(G_sondages.vrac.seuil); //Encore utile??? - bah ouais, ça évite de passer du temps à mettre des 1 et des 0 sur le php
        
        
        afficher_boutons_candidats();
        var candidats_sans_prefixe = [];
        G_sondages.selection_candidats.forEach(function(v, k){
            var chiffre = v.split("_")[1];
            candidats_sans_prefixe.push(chiffre);
        });
        
        
        // Voici à quoi ressemblent maintenant les données brutes pour former les courbes :

        //Reformatage des données et injection dans la classe Poll

        let dictToMap = (dict) => {
            let myMap=new Map();
            Object.keys(dict)
                .forEach( (key) => myMap.set( parseInt(key.replace('id_','')) , dict[key] )   );
            return myMap;
        };

        let tableCandidats=new Map();
        Object.keys(G_sondages.tables.candidats)
            .forEach( (key)=> {
            
                let newKey = parseInt(key.replace('id_','')),
                    newValue = Object.assign({}, G_sondages.tables.candidats[key]);   //Shallow copy
                newValue.couleur = G_sondages.couleurs[key];
                newValue.nom=newValue.nom_candidat;
                newValue.initiales=(newValue.nom)?newValue.nom.match(/[A-Z]/g).join(''):'';
                delete(newValue.nom_candidat);
                if (!isNaN(newKey)) tableCandidats.set(newKey,newValue);
                
            
            })

        //console.log(tableCandidats);
        const MainData=new DataWrapper('mainData')
                .push(G_sondages.tables.resultats_1)
                .map(d3.autoType);

        const Graph=new Poll('conteneur_graphique')
            .push('resultats',MainData)
            .push( 'candidats',tableCandidats)
            .push( 'sondages',dictToMap(G_sondages.tables.sondages))
            .draw();
        
//        Candidat.hide("all", 0);
//        Candidat.show(candidats_sans_prefixe,0);






    });
});


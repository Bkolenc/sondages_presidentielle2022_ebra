// Récupère tous les .csv
function recup_csv_tour1(callback)
{

    G_sondages.tables = {};
    let Promises=[],
        files=['candidats','populations','instituts','sondages','hypotheses_1','resultats_1'];
    files.forEach( (f) => Promises.push( d3.csv(`data/${f}.csv`)));

    Promise.all(Promises).then((values) => {
        [candidats,populations,instituts,sondages,hypotheses_1,resultats_1]=values;
        // Table candidats
        var candidats_formate = {};
        Object.keys(candidats).forEach(function (k) {
            var infos = candidats[k];
            var id = "id_" + infos.id;
            var a_push = {
                nom_candidat: infos.nom,
                parti: infos.parti,
                sigle: infos.sigle
            }
            candidats_formate[id] = a_push;
        });

        // Table populations
        var populations_formate = {};
        Object.keys(populations).forEach(function (k) {
            var infos = populations[k];
            var id = "id_" + infos.id;
            populations_formate[id] = infos.nom;
        });

        // Table instituts
        var instituts_formate = {};
        Object.keys(instituts).forEach(function (k) {
            var infos = instituts[k];
            var id = "id_" + infos.id;
            instituts_formate[id] = infos.nom;
        });

        // Table sondages
        var sondages_formate = {};
        Object.keys(sondages).forEach(function (k) {
            var infos = sondages[k];
            var id = "id_" + infos.id;
            var a_push = {
                id_institut: infos.id_institut,
                id_population: infos.id_population,
                commanditaire: infos.commanditaire,
                debut: infos.debut,
                fin: infos.fin,
                lien: infos.lien,
                echantillon: infos.echantillon
            }
            sondages_formate[id] = a_push;

        });

        // Table hypotheses
        var hypotheses_formate = {};
        Object.keys(hypotheses_1).forEach(function (k) {
            var infos = hypotheses_1[k];
            var id = "id_" + infos.id;
            var a_push = {
                nom_hyp: infos.nom,
                id_sondage: infos.id_sondage,
                s_echantillon: infos.sous_echantillon
            }
            hypotheses_formate[id] = a_push;

        });
        console.log(resultats_1);
        //Ajout de la date dans la table résultats
        resultats_1.forEach( (row)=> {
            let h=hypotheses_formate['id_'+row.id_hypothèse],
                s=sondages_formate['id_'+h.id_sondage];
            row.debut=s.debut;
        });

        G_sondages.tables = {
            candidats: candidats_formate,
            populations: populations_formate,
            instituts: instituts_formate,
            sondages: sondages_formate,
            hypotheses_1: hypotheses_formate,
            resultats_1: resultats_1
        }

        callback();

        /*  });
          });
          });
          });
          });
          });*/
    });
}

// Lit les tables téléchargées et les assemble dans un objet global minimaliste organisé par candidat (G_sondages.courbe_par_candidat)
function formater_donnees()
{

    var par_candidat = {};
    var candidats = G_sondages.tables.candidats,
        populations = G_sondages.tables.populations,
        instituts=G_sondages.tables.instituts,
        sondages=G_sondages.tables.sondages,
        hypotheses=G_sondages.tables.hypotheses_1,
        resultats=G_sondages.tables.resultats_1;

    Object.keys(resultats).forEach(function(k){
        if(k!="columns")
        {
            var infos = resultats[k];
            var id="id_"+infos.id_candidat;
            if(par_candidat[id] == undefined)
            {
                par_candidat[id] = [];
            }

            var id_sondage = hypotheses["id_"+infos.id_hypothèse].id_sondage;
            var date_fin = sondages["id_"+id_sondage].fin;
            var a_push = {
                resultat:infos.resultat,
                sup:infos.borne_sup,
                inf:infos.borne_inf,
                hyp:infos.id_hypothèse,
                date_fin:date_fin
            }
            par_candidat[id].push(a_push);
        }

    });
    Object.keys(par_candidat).forEach(function(id){
        var tableau = par_candidat[id].sort(function(a, b){
            return a.date_fin.localeCompare(b.date_fin);
        });
        par_candidat[id] = tableau;
    });

    G_sondages.courbe_par_candidat = par_candidat;
}

// Complète les données d'un des points de G_sondages.courbe_par_candidat donné en paramètre avec son id. Retourne toutes les infos nécessaires pour la popup et plus encore
function completer_point(id_candidat, point)
{
    var a_return = {};
    var t = G_sondages.tables;
    var le_candidat = t.candidats[id_candidat];

    var l_hypothese = t.hypotheses_1["id_"+point.hyp];

    var le_sondage = t.sondages["id_"+l_hypothese.id_sondage];

    var l_institut = t.instituts["id_"+le_sondage.id_institut];

    var la_population = t.populations["id_"+le_sondage.id_population];
    a_return.population = la_population;
    a_return.institut = l_institut;
    a_return = {...a_return, ...point, ...le_candidat, ...l_hypothese, ...le_sondage};
    return a_return;
}


// Pour ne pas trop saturer le html de code redondant, on crée les boutons de candidats en dynamique
function afficher_boutons_candidats()
{


    var candidats = G_sondages.tables.candidats;

    var tous_candidats = [];
    var candidats_dessus = [];
    var candidats_dessous = [];
    var candidats_oublies = [];
    Object.keys(candidats).forEach(function(id_candidat){
        if(id_candidat !="id_undefined")
        {
            var infos = candidats[id_candidat];
            var dernier_score = check_derniers_scores(id_candidat);
            var courbe = G_sondages.courbe_par_candidat[id_candidat];
            var derniere_date = courbe[courbe.length-1].date_fin;
            var ts_derniere_date = new Date(derniere_date).getTime();
            tous_candidats.push({id_candidat, ...candidats[id_candidat],
                derniere_date:ts_derniere_date,
                dernier_score:dernier_score})
        }
    });
    tous_candidats = tous_candidats.sort(function(a, b){
        return (b.dernier_score - a.dernier_score);
    });
    tous_candidats.forEach(function(v, k){
        if(v.derniere_date < G_sondages.vrac.seuil_date)
        {
            candidats_oublies.push(v);
        }
        else if(v.dernier_score >= G_sondages.vrac.seuil)
        {
            candidats_dessus.push(v);
        }
        else
        {
            candidats_dessous.push(v);
        }
    });

    candidats_dessus.forEach(function(v, k){

        afficher_candidat(v, "#tier_1")
    });
    candidats_dessous.forEach(function(v, k){
        afficher_candidat(v, "#tier_2")
    });
    candidats_oublies.forEach(function(v, k){
        afficher_candidat(v, "#tier_2")
    });

    function afficher_candidat(v, tier, selected)
    {
        var couleur = G_sondages.couleurs[v.id_candidat];


        if(v.nom_candidat != undefined && v.nom_candidat != "")
        {
            var url_img = "img/nopp.svg";
            if(couleur != undefined)
            {
                url_img = "img/"+v.id_candidat+".jpg";
            }
            var rgb = hexToRgb(couleur);
            var initiales = recup_initiales(v.nom_candidat);
            var avec_initiales = "&#10003;<br/>"+initiales; // plagiat du figaro
            var sans_initiales = "&#10003;";
            var sans_check = initiales;
            
            var couleur_croix = "";
            if(v.id_candidat == "id_12" || v.id_candidat == "id_4" || v.id_candidat == "id_20" || v.id_candidat == "id_29")
            {
                couleur_croix = " style='color:black;'";
            }
            var selection = d3.select(tier)
                .append("div")
                .attr("class","cont_candidat")
                .append("div")
                .attr("class", "candidat")
//                .style("border", "solid "+couleur+" 4px")
                .style("background-color",couleur)
                .attr("data-id",  v.id_candidat)
//                .html("div class='img")
                .html("<div class='img_et_init'>"+
                        "<div class='img_cont' style='background-image:url("+url_img+");'></div><p class='initiales' style='font-family:merriweather-sans;'>"+sans_check+"</p></div><p class='plus_moins'"+couleur_croix+">-</p>");
            
            
            
            //style='background-color:rgba("+rgb.r+","+rgb.g+","+rgb.b+", 0.3);
        }
    }

    maj_boutons_candidats();
}


function maj_boutons_candidats()
{

    var selected_candidats = G_sondages.selection_candidats;
    var selected_mieux = [];
    selected_candidats.forEach(function(v, k){
        selected_mieux.push(+v.split("_")[1]);
    });
    
    d3.selectAll(".candidat").each(function(){
        var id= this.getAttribute("data-id");
//        console.log(id);
        if(inArray(id, selected_candidats))
        {
            this.setAttribute("selected","selected");
            this.querySelector(".plus_moins").innerHTML = "-";
            
        }
        else
        {
            this.removeAttribute("selected");
            this.querySelector(".plus_moins").innerHTML = "+";
        }
    });
    
    click_candidats();
}
// Récupère les listes des points par candidats et ne garde que les listes dont les points du dernier sondage ont une moyenne supérieure ou égale au seuil
function candidats_par_defaut(seuil)
{
    var candidats_select = [];

    var infos = G_sondages.courbe_par_candidat;
    Object.keys(infos).forEach(function(id_candidat){
        liste = infos[id_candidat];
        var derniere_date = liste[liste.length-1].date_fin;
        var derniers_scores = [];

        var derniere_date = liste[liste.length-1].date_fin;
        var ts_derniere_date = new Date(derniere_date).getTime();
        liste.forEach(function(v, idx){
            if(v.date_fin == derniere_date)
            {
                derniers_scores.push(+v.resultat);
            }
        });
        var somme = 0;
        derniers_scores.forEach(function(v, idx){
            somme += v;
        });
        var moyenne = somme/derniers_scores.length;
        if(moyenne >= seuil && ts_derniere_date>=G_sondages.vrac.seuil_date)
        {
            candidats_select.push(id_candidat);
        }
    });
    G_sondages.selection_candidats = candidats_select;

}

function check_derniers_scores(id_candidat)
{

    var infos = G_sondages.courbe_par_candidat;
    liste = infos[id_candidat];
    var derniere_date = liste[liste.length-1].date_fin;
//    var ts_derniere_date = new Date(derniere_date).getTime();

    var derniers_scores = [];
    liste.forEach(function(v, idx){
        if(v.date_fin == derniere_date)
        {
            derniers_scores.push(+v.resultat);
        }
    });
    var somme = 0;
    derniers_scores.forEach(function(v, idx){
        somme += v;
    });
    var moyenne = somme/derniers_scores.length;
    return moyenne;
}

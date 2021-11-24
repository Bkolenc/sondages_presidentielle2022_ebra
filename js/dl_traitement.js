// Récupère tous les .csv
function recup_csv_tour1(callback)
{
    G_sondages.tables = {};
    
    d3.csv("data/candidats.csv").then(function(candidats){
    d3.csv("data/populations.csv").then(function(populations){
    d3.csv("data/instituts.csv").then(function(instituts){
    d3.csv("data/sondages.csv").then(function(sondages){
    d3.csv("data/hypotheses_1.csv").then(function(hypotheses_1){
    d3.csv("data/resultats_1.csv").then(function(resultats_1){
        
        // Pour faciliter l'assemblage des données, on fait passer la structure des tables de référence depuis des arrays vers des dictionnaires indexés par id
        
        // Table candidats
        var candidats_formate = {};
        Object.keys(candidats).forEach(function(k){
            var infos = candidats[k];
            var id = "id_"+infos.id;
            var a_push = {
                nom_candidat:infos.nom,
                parti:infos.parti
            }
            candidats_formate[id] = a_push;
        });
        
        // Table populations
        var populations_formate = {};
        Object.keys(populations).forEach(function(k){
            var infos = populations[k];
            var id = "id_"+infos.id;
            populations_formate[id] = infos.nom;
        });
        
        // Table instituts
        var instituts_formate = {};
        Object.keys(instituts).forEach(function(k){
            var infos = instituts[k];
            var id = "id_"+infos.id;
            instituts_formate[id] = infos.nom;
        });
        
        // Table sondages
        var sondages_formate = {};
        Object.keys(sondages).forEach(function(k){
            var infos = sondages[k];
            var id = "id_"+infos.id;
            var a_push = {
                id_institut:infos.id_institut,
                id_population:infos.id_population,
                commanditaire:infos.commanditaire,
                debut:infos.debut,
                fin:infos.fin,
                lien:infos.lien,
                echantillon:infos.echantillon
            }
            sondages_formate[id] = a_push;
            
        });
        
        // Table hypotheses
        var hypotheses_formate = {};
        Object.keys(hypotheses_1).forEach(function(k){
            var infos = hypotheses_1[k];
            var id = "id_"+infos.id;
            var a_push = {
                nom_hyp:infos.nom,
                id_sondage:infos.id_sondage,
                s_echantillon:infos.sous_echantillon
            }
            hypotheses_formate[id] = a_push;
            
        });
        
        G_sondages.tables = {
            candidats:candidats_formate,
            populations:populations_formate,
            instituts:instituts_formate,
            sondages:sondages_formate,
            hypotheses_1:hypotheses_formate,
            resultats_1:resultats_1
        }
        
        callback();
        
    });
    });
    });
    });
    });
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
        
    })
    
    G_sondages.courbe_par_candidat = par_candidat;
}

// Pour ne pas trop saturer le html de code redondant, on crée les boutons de candidats en dynamique
function afficher_boutons_candidats()
{
    // A FAIRE
    // - Ajouter une photo placeholder (nopp.svg) si aucune photo dispo
    
    var candidats = G_sondages.tables.candidats;
    
    Object.keys(candidats).forEach(function(id_candidat){
        
        var couleur = G_sondages.couleurs[id_candidat];
        var infos = candidats[id_candidat];
        
        if(infos.nom_candidat != undefined && infos.nom_candidat != "")
        {
            //var url_img = "img/"+id_candidat+".jpg";
            var url_img = "img/placeholder.jpg";

            var rgb = hexToRgb(couleur);
            var initiales = recup_initiales(infos.nom_candidat);
            
            
            // Format de la ribambelle de candidats à revoir avec Caroline Faure, mais la logique resterait la même
            var avec_initiales = "&#10003;<br/>"+initiales; // plagiat du figaro
            var sans_initiales = "&#10003;";
            var sans_check = initiales;
            var selection = d3.select("#conteneur_candidats")
                .append("div")
                .attr("class", "candidat")
                .style("border", "solid "+couleur+" 4px")
                .attr("data-id",  id_candidat)
                    .html("<div class='img_cont' style='background-image:url("+url_img+")'></div><p class='initiales' style='background-color:rgba("+rgb.r+","+rgb.g+","+rgb.b+", 0.3);'>"+sans_check+"</p>");
//                    .attr("src",url_img);
        }
        
    });
    maj_boutons_candidats();
}


function maj_boutons_candidats()
{
    
    var selected_candidats = G_sondages.selection_candidats;
    
    d3.selectAll(".initiales").each(function(){
        var id= this.parentNode.getAttribute("data-id");
        
        if(inArray(id, selected_candidats))
        {
            this.setAttribute("selected","selected");
        }
        else
        {
            this.removeAttribute("selected")
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
        if(moyenne >= seuil)
        {
            candidats_select.push(id_candidat);
        }
    });
    G_sondages.selection_candidats = candidats_select;
    
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
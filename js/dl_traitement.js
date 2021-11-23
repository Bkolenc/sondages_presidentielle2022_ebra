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

// Lit les csv téléchargés et les assemble dans un objet global minimaliste organisé par candidat (G_sondages.courbe_par_candidat)
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
//            console.log(id_sondage)
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
    a_return = {...a_return, ...point, ...le_candidat, ...l_hypothese, ...le_sondage}
    return a_return;
}
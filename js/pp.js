// pp = programme principal


recup_csv_tour1(function(){ // FOnction Async, attention
    
    // On formate les données :
    formater_donnees();
    
    // Voici à quoi ressemblent maintenant les données brutes pour former les courbes :
    console.log(G_sondages.courbe_par_candidat);
    
    // Tests pour afficher toutes les infos relatives à un point :
    var point_1 = G_sondages.courbe_par_candidat["id_3"][4],
        point_2 = G_sondages.courbe_par_candidat["id_16"][32];
    
    console.log(completer_point("id_3", point_1));
    console.log(completer_point("id_16", point_2));
});
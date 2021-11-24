recup_csv_tour1(function(){ // Fonction Async, attention
    
    // On formate les données :
    formater_donnees();
    
    
    // On sélectionne les candidats s'affichant par défaut en fixant un seuil (en pourcent)
    candidats_par_defaut(5);
    afficher_boutons_candidats();
       // Voici à quoi ressemblent maintenant les données brutes pour former les courbes :
    console.log(G_sondages);
    
    
    // Tests pour afficher toutes les infos relatives à un point :
//    var point_1 = G_sondages.courbe_par_candidat["id_3"][4],
//        point_2 = G_sondages.courbe_par_candidat["id_16"][32];
//    console.log(completer_point("id_3", point_1));
//    console.log(completer_point("id_16", point_2));
});
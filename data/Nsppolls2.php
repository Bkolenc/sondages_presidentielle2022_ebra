<?php

$url = "https://raw.githubusercontent.com/nsppolls/nsppolls/master/presidentielle.json";
//$url = "presidentielle.jsgit on";
$file = file_get_contents($url);
$correspondances = array(
    "Anne Hidalgo"          =>  ["PS",  1, "id_1"],
    "Nicolas Dupont-Aignan" =>  ["DLF", 1, "id_2"],
    "Marine Le Pen"         =>  ["RN",  1, "id_3"],
    "Yannick Jadot"         =>  ["EELV",1, "id_4"],
    "Valérie Pécresse"      =>  ["LR",  1, "id_5"],
    "Fabien Roussel"        =>  ["PCF", 1, "id_6"],
    "Eric Zemmour"          =>  ["",    1, "id_7"],
    "Nathalie Arthaud"      =>  ["LO",  1, "id_8"],
    "Arnaud Montebourg"     =>  ["",    1, "id_9"],
    "Philippe Poutou"       =>  ["NPA", 1, "id_10"],
    "Jean-Luc Mélenchon"    =>  ["LFI", 1, "id_11"],
    "Emmanuel Macron"       =>  ["LREM",1, "id_12"],
    "Xavier Bertrand"       =>  ["LR",  0, "id_13"],
    "Michel Barnier"        =>  ["LR",  0, "id_14"],
    "Jean Lassalle"         =>  ["",    1, "id_15"],
    "Florian Philippot"     =>  ["LP",  1, "id_16"],
    "François Asselineau"   =>  ["UPR", 1, "id_17"],
    "Jean-Christophe Lagarde"=> ["UDI", 0, "id_18"],
    "Jean-Frédéric Poisson" =>  ["PCD", 1, "id_19"],
    "Sandrine Rousseau"     =>  ["EELV",-1,"id_20"],
    "Laurent Wauquiez"      =>  ["LR",  0, "id_21"],
    "François Baroin"       =>  ["LR",  -1,"id_22"],
    "Rachida Dati"          =>  ["LR",  -1,"id_23"],
    "Olivier Faure"         =>  ["PS",  -1,"id_24"],
    "Ségolène Royal"        =>  ["PS",  -1,"id_25"],
    "Bruno Retailleau"      =>  ["LR",  -1,"id_26"],
    "François Hollande"     =>  ["PS",  -1,"id_27"],
    "Eric Piolle"           =>  ["EELV",-1,"id_29"],
    "Eric Ciotti"           =>  ["LR",  0, "id_30"],
    "Philippe Juvin"        =>  ["LR",  0, "id_31"],
    "Denis Payre"           =>  ["LR",  -1,"id_32"],
    "Jacques Cheminade"     =>  ["SP",  1, "id_33"],
    "Hélène Thouy"          =>  ["PA",  1, "id_34"]
    
);
//$correspondances = array(
//    "1"=>["PS",     1],
//    "2"=>["DLF",    1],
//    "3"=>["RN",     1],
//    "4"=>["EELV",   1],
//    "5"=>["LR",     1],
//    "6"=>["PCF",    1],
//    "7"=>["",       1],
//    "8"=>["LO",     1],
//    "9"=>["",       1],
//    "10"=>["NPA",   1],
//    "11"=>["LFI",   1],
//    "12"=>["LREM",  1],
//    "13"=>["LR",    0],
//    "14"=>["LR",    0],
//    "15"=>["",      1],
//    "16"=>["LP",    1],
//    "17"=>["UPR",   1],
//    "18"=>["UDI",   0],
//    "19"=>["PCD",   1],
//    "20"=>["EELV",  -1],
//    "21"=>["LR",    0],
//    "22"=>["LR",    -1],
//    "23"=>["LR",    -1],
//    "24"=>["PS",    -1],
//    "25"=>["PS",    -1],
//    "26"=>["LR",    -1],
//    "27"=>["PS",    -1],
//    "29"=>["EELV",  -1],
//    "30"=>["LR",    0],
//    "31"=>["LR",    0],
//    "32"=>["LR",    -1],
//    "33"=>["SP",    1],
//    "34"=>["PA",    1]
//    
//);
$objet = json_decode($file);

$instituts_traites = array();
$candidats_traites = array();
$populations_traitees = array();

$instituts = array();
$instituts[] = ["id", "nom"];

$populations = array();
$populations[] = ["id", "nom"];

$sondages = array();
$sondages[] = ["id", "id_institut", "commanditaire", "debut", "fin", "lien", "echantillon", "id_population"];

$hypotheses_1 = array();
$hypotheses_1[] = ["id", "nom", "id_sondage", "tour", "sous_echantillon"];

$hypotheses_2 = array();
$hypotheses_2[] = ["id", "nom", "id_sondage", "tour", "sous_echantillon"];

$resultats_1 = array();
$resultats_1[] = ["id_candidat", "id_hypothèse", "borne_sup", "borne_inf", "resultat"];

$resultats_2 = array();
$resultats_2[] = ["id_candidat", "id_hypothèse", "borne_sup", "borne_inf", "resultat"];

$candidats = array();
$candidats[] = ["id", "nom", "parti", "sigle","defaut", "id_photo"];

foreach ($objet as $k=>$v)
{
//    var_dump($v);
    
    // Les strings et nombres
    $id_sondage = $v->id;
    $nom_institut = $v->nom_institut;
    $debut_enquete = $v->debut_enquete;
    $fin_enquete = $v->fin_enquete;
    $commanditaire = $v->commanditaire;
    $lien = $v->lien;
    $echantillon = $v->echantillon;
    $population = $v->population;
    
    // Les objets
    $tours = $v->tours;
    $tour1;
    $tour2;
    // premier tour
    foreach($tours as $kk=>$vv)
    {
        echo $vv->tour;
        if($vv->tour == "Deuxième tour")
        {
            $tour2 = $vv->hypotheses;
        }
        else if($vv->tour == "Premier tour")
        {
            $tour1 = $vv->hypotheses;
        }
    }
    
    
    
    // Check si l'institut est déjà passé
    if(!in_array($nom_institut, $instituts_traites))
    {
        $instituts_traites[] = $nom_institut;
        $index = count($instituts);
        $instituts[] = [$index, $nom_institut];
    }
    
    // Check si le type de population est déjà passé
    if(!in_array($population, $populations_traitees))
    {
        $populations_traitees[] = $population;
        $index = count($populations);
        $populations[] = [$index, $population];
    }
    
    $id_institut = nom_vers_id($nom_institut, $instituts, 0,1);
    $id_population = nom_vers_id($population, $populations, 0,1);
    $id_sondage = count($sondages);
    $sondages[] = [$id_sondage, $id_institut, $commanditaire, $debut_enquete, $fin_enquete, $lien, $echantillon, $id_population ];
    
    
    // Maintenant on itère sur les hypothèses
    foreach($tour1 as $kk => $hyp)
    {
        $nom_hypothese = $hyp->hypothese;
        $sous_ec = $hyp->sous_echantillon;
        $tour = 1;
        $id_hyp = count($hypotheses_1);
        $hypotheses_1[] = [$id_hyp, $nom_hypothese, $id_sondage, $tour, $sous_ec];
        ///////////
        
        $candidatss = $hyp->candidats;
        
        foreach($candidatss as $kkk=>$c)
        {
//            var_dump($c);
            // On inclut les candidats dans la table
            $nom = $c->candidat;
            
            $partis = $c->parti;
            $parti = "";
            foreach($partis as $p)
            {
                $parti .= $p." ";
            }
            
            $intentions = $c->intentions;
            $sup = $c->erreur_sup;
            $inf = $c->erreur_inf;
            
            // Check si le candidat est déjà passé et update de la table candidats
            if(!in_array($nom, $candidats_traites))
            {
                $candidats_traites[] = $nom;
                $index = count($candidats);
                $sigle = "";
                $degage = "";
                $url = "";
                try
                {
                    $sigle = $correspondances[$nom][0];
                    $degage = $correspondances[$nom][1];
                    $url = $correspondances[$nom][2];
                }
                catch(Exception $e)
                {
                    
                }
                
                
                
                
                $candidats[] = [$index, $nom, $parti, $sigle, $degage, $url];
            }
            
            $id_candidat = nom_vers_id($nom, $candidats, 0,1);
            // On remplit la table Resultats
            $resultats_1[] = [$id_candidat, $id_hyp, $sup, $inf, $intentions];
        }
        
    }
    if(isset($tour2))
    {
        foreach($tour2 as $kk => $hyp)
        {
            $nom_hypothese = $hyp->hypothese;
            $sous_ec = $hyp->sous_echantillon;
            $tour = 1;
            $id_hyp = count($hypotheses_2);
            $hypotheses_2[] = [$id_hyp, $nom_hypothese, $id_sondage, $tour, $sous_ec];
            ///////////

            $candidatss = $hyp->candidats;
            
            foreach($candidatss as $kkk=>$c)
            {
    //            var_dump($c);
                // On inclut les candidats dans la table
                $nom = $c->candidat;

                $partis = $c->parti;
                $parti = "";
                foreach($partis as $p)
                {
                    $parti .= $p." ";
                }

                $intentions = $c->intentions;
                $sup = $c->erreur_sup;
                $inf = $c->erreur_inf;

                // Check si le candidat est déjà passé et update de la table candidats
                if(!in_array($nom, $candidats_traites))
                {
                    $candidats_traites[] = $nom;
                    $index = count($candidats);
                    $candidats[] = [$index, $nom, $parti];
                }

                $id_candidat = nom_vers_id($nom, $candidats, 0,1);
                // On remplit la table Resultats
                $resultats_2[] = [$id_candidat, $id_hyp, $sup, $inf, $intentions];
            }

        }
    }
    

    
}


//var_dump($resultats_1);
//echo("<br/>");
//var_dump($resultats_2);
//echo("<br/>");
//var_dump($hypotheses_1);
//echo("<br/>");
//var_dump($hypotheses_2);
//echo("<br/>");
//var_dump($candidats);
//echo("<br/>");
//var_dump($populations);
//echo("<br/>");
//var_dump($instituts);
//echo("<br/>");
//var_dump($sondages);
//echo str_putcsv($instituts);
//echo str_putcsv($resultats_1);
file_put_contents ("resultats_1.csv" , str_putcsv($resultats_1));
file_put_contents ("resultats_2.csv" , str_putcsv($resultats_2));
file_put_contents ("hypotheses_1.csv" , str_putcsv($hypotheses_1));
file_put_contents ("hypotheses_2.csv" , str_putcsv($hypotheses_2));
file_put_contents ("candidats.csv" , str_putcsv($candidats));
file_put_contents ("populations.csv" , str_putcsv($populations));
file_put_contents ("instituts.csv" , str_putcsv($instituts));
file_put_contents ("sondages.csv" , str_putcsv($sondages));

function str_putcsv($data) {
        # Generate CSV data from array
        $fh = fopen('php://temp', 'rw'); # don't create a file, attempt
                                         # to use memory instead

        # write out the headers
//        fputcsv($fh, array_keys(current($data)));

        # write out the data
        foreach ( $data as $row ) {
                fputcsv($fh, $row);
        }
        rewind($fh);
        $csv = stream_get_contents($fh);
        fclose($fh);

        return $csv;
}
function nom_vers_id($nom, $array, $index_id, $index_nom)
{
    $id;
    foreach($array as $k=>$v)
    {
        if($v[$index_nom] == $nom)
        {
            $id = $v[$index_id];
        }
    }
    return $id;
}

?>
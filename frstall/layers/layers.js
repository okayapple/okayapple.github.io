var wms_layers = [];


        var lyr_Google_0 = new ol.layer.Tile({
            'title': 'Google',
            'opacity': 0.800000,
            
            
            source: new ol.source.XYZ({
            attributions: ' ',
                url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
            })
        });
var format__1 = new ol.format.GeoJSON();
var features__1 = format__1.readFeatures(json__1, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource__1 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource__1.addFeatures(features__1);
var lyr__1 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource__1, 
                style: style__1,
                popuplayertitle: 'кадастр',
                interactive: false,
    title: 'кадастр<br />\
    <img src="styles/legend/_1_0.png" /> 0 - 0,013<br />\
    <img src="styles/legend/_1_1.png" /> 0,013 - 0,038<br />\
    <img src="styles/legend/_1_2.png" /> 0,038 - 0,057<br />\
    <img src="styles/legend/_1_3.png" /> 0,057 - 0,079<br />\
    <img src="styles/legend/_1_4.png" /> 0,079 - 0,105<br />\
    <img src="styles/legend/_1_5.png" /> 0,105 - 0,134<br />\
    <img src="styles/legend/_1_6.png" /> 0,134 - 0,166<br />\
    <img src="styles/legend/_1_7.png" /> 0,166 - 0,199<br />\
    <img src="styles/legend/_1_8.png" /> 0,199 - 0,236<br />\
    <img src="styles/legend/_1_9.png" /> 0,236 - 0,272<br />\
    <img src="styles/legend/_1_10.png" /> 0,272 - 0,306<br />\
    <img src="styles/legend/_1_11.png" /> 0,306 - 0,344<br />\
    <img src="styles/legend/_1_12.png" /> 0,344 - 0,395<br />\
    <img src="styles/legend/_1_13.png" /> 0,395 - 0,456<br />\
    <img src="styles/legend/_1_14.png" /> 0,456 - 0,527<br />\
    <img src="styles/legend/_1_15.png" /> 0,527 - 0,57<br />\
    <img src="styles/legend/_1_16.png" /> 0,57 - 0,646<br />\
    <img src="styles/legend/_1_17.png" /> 0,646 - 0,734<br />\
    <img src="styles/legend/_1_18.png" /> 0,734 - 0,919<br />\
    <img src="styles/legend/_1_19.png" /> 0,919 - 1<br />' });
var format__2 = new ol.format.GeoJSON();
var features__2 = format__2.readFeatures(json__2, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource__2 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource__2.addFeatures(features__2);
var lyr__2 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource__2, 
                style: style__2,
                popuplayertitle: 'контур',
                interactive: false,
                title: '<img src="styles/legend/_2.png" /> контур'
            });

lyr_Google_0.setVisible(true);lyr__1.setVisible(true);lyr__2.setVisible(true);
var layersList = [lyr_Google_0,lyr__1,lyr__2];
lyr__1.set('fieldAliases', {'fid': 'fid', 'cadnum': 'cadnum', 'ownership': 'ownership', 'земба': 'земба', 'лес_п�': 'лес_п�', });
lyr__2.set('fieldAliases', {'Name': 'Name', 'folder_nam': 'folder_nam', 'area_m': 'area_m', 'id': 'id', 'perimeter': 'perimeter', 'cult_id': 'cult_id', 'res_id': 'res_id', 'cult': 'cult', 'group_name': 'group_name', });
lyr__1.set('fieldImages', {'fid': '', 'cadnum': '', 'ownership': '', 'земба': '', 'лес_п�': '', });
lyr__2.set('fieldImages', {'Name': '', 'folder_nam': '', 'area_m': '', 'id': '', 'perimeter': '', 'cult_id': '', 'res_id': '', 'cult': '', 'group_name': '', });
lyr__1.set('fieldLabels', {'fid': 'no label', 'cadnum': 'no label', 'ownership': 'no label', 'земба': 'no label', 'лес_п�': 'no label', });
lyr__2.set('fieldLabels', {'Name': 'no label', 'folder_nam': 'no label', 'area_m': 'no label', 'id': 'no label', 'perimeter': 'no label', 'cult_id': 'no label', 'res_id': 'no label', 'cult': 'no label', 'group_name': 'no label', });
lyr__2.on('precompose', function(evt) {
    evt.context.globalCompositeOperation = 'normal';
});
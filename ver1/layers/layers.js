var wms_layers = [];


        var lyr_Google_0 = new ol.layer.Tile({
            'title': 'Google карта',
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
                popuplayertitle: 'верес кадастры',
                interactive: false,
                title: '<img src="styles/legend/_1.png" /> верес кадастры'
            });
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
                popuplayertitle: 'верес строения',
                interactive: false,
                title: '<img src="styles/legend/_2.png" /> верес строения'
            });
var format__3 = new ol.format.GeoJSON();
var features__3 = format__3.readFeatures(json__3, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource__3 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource__3.addFeatures(features__3);
var lyr__3 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource__3, 
                style: style__3,
                popuplayertitle: 'верес поля',
                interactive: false,
                title: '<img src="styles/legend/_3.png" /> верес поля'
            });

lyr_Google_0.setVisible(true);lyr__1.setVisible(true);lyr__2.setVisible(true);lyr__3.setVisible(true);
var layersList = [lyr_Google_0,lyr__1,lyr__2,lyr__3];
lyr__1.set('fieldAliases', {'cadnum': 'cadnum', });
lyr__2.set('fieldAliases', {'cadnum': 'cadnum', });
lyr__3.set('fieldAliases', {'id': 'id', 'имя': 'имя', 'агент': 'агент', 'дата': 'дата', 'area': 'area', });
lyr__1.set('fieldImages', {'cadnum': '', });
lyr__2.set('fieldImages', {'cadnum': '', });
lyr__3.set('fieldImages', {'id': '', 'имя': '', 'агент': '', 'дата': '', 'area': '', });
lyr__1.set('fieldLabels', {'cadnum': 'no label', });
lyr__2.set('fieldLabels', {'cadnum': 'no label', });
lyr__3.set('fieldLabels', {'id': 'no label', 'имя': 'no label', 'агент': 'no label', 'дата': 'no label', 'area': 'no label', });
lyr__3.on('precompose', function(evt) {
    evt.context.globalCompositeOperation = 'normal';
});
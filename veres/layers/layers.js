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
                popuplayertitle: 'верес',
                interactive: false,
                title: '<img src="styles/legend/_1.png" /> верес'
            });
var format_cat10_2 = new ol.format.GeoJSON();
var features_cat10_2 = format_cat10_2.readFeatures(json_cat10_2, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_cat10_2 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_cat10_2.addFeatures(features_cat10_2);
var lyr_cat10_2 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_cat10_2, 
                style: style_cat10_2,
                popuplayertitle: 'cat10',
                interactive: false,
                title: '<img src="styles/legend/cat10_2.png" /> cat10'
            });

lyr_Google_0.setVisible(true);lyr__1.setVisible(true);lyr_cat10_2.setVisible(true);
var layersList = [lyr_Google_0,lyr__1,lyr_cat10_2];
lyr__1.set('fieldAliases', {'cadnum': 'cadnum', });
lyr_cat10_2.set('fieldAliases', {'name': 'name', 'id': 'id', 'points_cou': 'points_cou', });
lyr__1.set('fieldImages', {'cadnum': '', });
lyr_cat10_2.set('fieldImages', {'name': '', 'id': '', 'points_cou': '', });
lyr__1.set('fieldLabels', {'cadnum': 'no label', });
lyr_cat10_2.set('fieldLabels', {'name': 'no label', 'id': 'no label', 'points_cou': 'no label', });
lyr_cat10_2.on('precompose', function(evt) {
    evt.context.globalCompositeOperation = 'normal';
});
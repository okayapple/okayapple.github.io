var wms_layers = [];


        var lyr_Google_0 = new ol.layer.Tile({
            'title': 'Google карта',
            //'type': 'base',
            'opacity': 0.800000,
            
            
            source: new ol.source.XYZ({
    attributions: ' ',
                url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
            })
        });
var format_17337CASE44302023AST_1 = new ol.format.GeoJSON();
var features_17337CASE44302023AST_1 = format_17337CASE44302023AST_1.readFeatures(json_17337CASE44302023AST_1, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_17337CASE44302023AST_1 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_17337CASE44302023AST_1.addFeatures(features_17337CASE44302023AST_1);
var lyr_17337CASE44302023AST_1 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_17337CASE44302023AST_1, 
                style: style_17337CASE44302023AST_1,
                popuplayertitle: "17337 CASE4430 (2023) AST",
                interactive: false,
                    title: '<img src="styles/legend/17337CASE44302023AST_1.png" /> 17337 CASE4430 (2023) AST'
                });

lyr_Google_0.setVisible(true);lyr_17337CASE44302023AST_1.setVisible(true);
var layersList = [lyr_Google_0,lyr_17337CASE44302023AST_1];
lyr_17337CASE44302023AST_1.set('fieldAliases', {'name': 'name', });
lyr_17337CASE44302023AST_1.set('fieldImages', {'name': '', });
lyr_17337CASE44302023AST_1.set('fieldLabels', {'name': 'no label', });
lyr_17337CASE44302023AST_1.on('precompose', function(evt) {
    evt.context.globalCompositeOperation = 'normal';
});
window.setTimeout(function () {
	var qxRoot = qx.core.Init.getApplication().getRoot();
    //qx.locale.Manager.getInstance().setLocale("en");

    if (!Detector.webgl) {
        // create the window instance
        var root = qx.core.Init.getApplication().getRoot();
        var win = new qx.ui.window.Window( qxRoot.tr("Erreur : WebGL non supporté") );
        win.setLayout(new qx.ui.layout.VBox(10));

        win.set({
            width : 400,
            alwaysOnTop : true,
            showMinimize : false,
            showMaximize : false,
            showClose : false,
            centerOnAppear : true,
            modal : true,
            movable : false,
            resizable : false,
            allowClose : false,
            allowMaximize : false,
            allowMinimize : false
        });


        // label to show the e.g. the alert message

        win.add(new qx.ui.basic.Label(qxRoot.tr("WebGL n'est pas supporté par votre système.")));


        root.add(win);


        win.open();
        return;
    }















    var container = new qx.ui.container.Composite(new qx.ui.layout.HBox());

    qxRoot.add(container, {width:"100%", height:"100%"});

    //var sideViewer = new desk.IfeContainer();
    var mainViewer = new desk.IfeContainer(/* sideViewer */);

	container.add(mainViewer, {flex : 1});
    //container.add(sideViewer, {flex : 1});
    //sideViewer.exclude();
});

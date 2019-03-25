window.setTimeout(function () {
	var qxRoot = qx.core.Init.getApplication().getRoot();
    //qx.locale.Manager.getInstance().setLocale("en");

    if (!Detector.isWebGLAvailable()) {
      console.log("WebGLUnavalable");
        // create the window instance
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
        qxRoot.add(win);
        win.open();
        return;
    }

    //var container = new qx.ui.container.Composite(new qx.ui.layout.HBox());
    var container = new qx.ui.splitpane.Pane("horizontal");
    console.log(container);
    container.getChildControl("splitter").setBackgroundColor("#C0C0C0");
    
    qxRoot.add(container, {width:"100%", height:"100%"});
//    qxRoot.add(container, {top:0, left:0, bottom:0, right:0, width:"100%", height:"100%"});
    var sideViewer = new desk.IfeContainer();
    var mainViewer = new desk.IfeContainer( sideViewer );

    sideViewer.setMainViewer(mainViewer);
    
	  container.add(mainViewer);
    container.add(sideViewer);
    sideViewer.exclude();

    const ipc = require("electron").ipcRenderer;
    ipc.send('qx-ready');

});

var csrftoken = $('meta[name=csrf-token]').attr('content')

$.ajaxSetup({
    beforeSend: function(xhr, settings) {
        if (!/^(GET|HEAD|OPTIONS|TRACE)$/i.test(settings.type) && !this.crossDomain) {
            xhr.setRequestHeader("X-CSRFToken", csrftoken)
        }
    }
})

$("#capture").on("click", function() {
    sreenShot($('#chart_box'));
});

function sreenShot(target) {
    if (target != null && target.length > 0) {

        var t = target[0];
        html2canvas(t).then(function(canvas) {
            var myImg = canvas.toDataURL("image/png");
            myImg = myImg.replace("data:image/png;base64,", "");

            $.ajax({
                method: "POST",
                data: {
                    "imgSrc": myImg
                },
                dataType: "text",
                url: '/email',
                success: function(data) {
                    console.log('success');
                },
                error: function(a, b, c) {
                    alert("error");
                }
            });
        });
    }
}
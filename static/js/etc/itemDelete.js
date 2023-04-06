$('.delete').click(function(e) {
    var postName = e.target.dataset.id;
    const nowClick = $(this);
    $.ajax({
        method: 'DELETE',
        url: '/saved-room',
        data: postName
    }).done(function(result) {
        console.log('성공!');
        nowClick.parent('li').fadeOut();
    }).fail(function(xhr, textStatus, errorThrown) {
        console.log(xhr, textStatus, errorThrown);
    });
});
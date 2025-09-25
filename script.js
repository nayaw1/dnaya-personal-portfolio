function toggleMenu() {
    //targets a certain element on the webpage which is the menuLinks and hamburgerIcon class
    const menu = document.querySelector('.menuLinks');
    const icon = document.querySelector('.hamburgerIcon');
    //when the function is called it will toggle the class open for both menu and icon
    menu.classList.toggle('open');
    icon.classList.toggle('open');
}
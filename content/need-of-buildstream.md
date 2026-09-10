## The new need of Buildstream

### What is Buildstream?
Apache Buildstream is an amazing way to automate builds of anything. I am personally using it for Linux images for both desktop and server, you can intergrate this with Git souce code holders be it Github, Gitlab and hell even non Git options, You can build with tools such as Make, CMake, Meson, Pip and others and use languages like Rust, C and Java with more of course, basically this is a great way to get your software built since it can do anything you need!

### Why for deskop and server images
If you can use this for standard software what benifets do you get for a desktop/server container image? Basically in one of my previous blog posts I mentioned that I love the source based nature of Gentoo with getting things straight from the source but here is the issue you have to get the ebuild from Gentoo or make it yourself you can't really manage it well if you choose making it yourself, so either make a tool like I did or just use the standard repos I didn't like either of those for a Bootc image, so with Buildstream I can make my own [Bluefin Dakota](https://github.com/projectbluefin/dakota) which this is a Gnome OS based Bootc image but to say it more simple it's just Gnome with tweaks, now for a server I am making my own FSDK based image which is called [Microraptor](https://github.com/HuntedRaven7/Microraptor) just because it is small and based on Bluefin's [server](https://github.com/projectbluefin/server) image which is also FSDK based, I carry some stuff they don't like wifi and such with Network Manager and more I have basically my whole homelab in the repo besides .envs for well known reasons.

### Why should I use it?
The reason you should use Buildstream is it's a great project that makes it easy to build projects be it a Gnome OS based image or just a random piece of Rust code you made on a weekend with Claude.

### That's it for this Ted Talk
Thank you for your time!

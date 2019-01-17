Hi Guys,

This was definitely one of the more interesting and unique tasks I have gotten. I managed to do everything except the floods in +- 2 hours. The rest of the evening I spent on the floods which were definitely something I had not done before so was very interesting.

I hope you can see what I was going for, below I have also listed some of the improvements I would do if I had more time. (besides just more testing/tweaking)

### Dependencies
- redis on the default port. 
- To run redis on docker: docker run --name my-redis -p 6379:6379 --detach redis.
- The reason is redis is required is because I chose to use bee-queue to manage the child processes. which relies on redis. 

### Running it
- because of raw-socket that is used for syn it requires sudo permissions. you can run it without but the syn flood will not have permission to create the sockets.
- sudo npx ts-node src/ddos.ts https://google.com (if you run it without it will just not do the syn-flood)

### improvements
- change scanTasks to be about a range of ports instead of one task for each port. this would significantly speed up task creation.
- The floods now rely on node to assign a random port could be made more efficient/more elegant.
- Better coordination for the attack/floods. consider assigning targets to processes instead of all processes targeting everything.
- add ipv6 support to syn-flood
- exit process when done.
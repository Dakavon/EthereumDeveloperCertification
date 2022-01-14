# Ethereum Developer Certification

This is an excerpt from my final exam of the **Ethereum Developer Course** by [B9lab](https://academy.b9lab.com) that led to my [Ethereum Developer certification](https://certificates.b9lab.com/certificate.html?uuid=04e3aad4-3d1f-4758-a30a-dda07ad821be).

## Final project: Toll Road System
..without revealing too much (by B9lab):
> Our project describes a road system that will be represented by 2 overarching smart contracts:
>
> * `Regulator`
> * `TollBoothOperator`
>
> These other elements of the system are represented by externally owned accounts:
>
> * owner of `Regulator`
> * owner of `TollBoothOperator`
> * individual vehicles
> * individual toll booths

There were many more requirements e.g. how `route prices` are calculated, how `external accounts` (vehicles, toll booths, operator) are handled and how `specific scenarios` need to play out. All interfaces were defined by B9lab beforehand.

I had to fill the contracts with code and bring the dApp to life which also needed to be tested thoroughly with a full test routine (see [example in /test](test)).
A simple GUI should also be created which you can see below.

## My developed application 'TollRoadApp'

### Tech stack
- truffle
- ganache
- web3.js
- react
- chakra-ui
- ..served out of a vagrant box
- see also [package.json](package.json)

### Regulator
- can register new vehicles and
- can allow new operators

![TollRoadApp_v1-0-0_Regulator](screenshots/TollRoad_Regulator.png)

### Operator
- has an simple overview of its contract and TVL information
- can add new booths as a toll road operator and
- can set/modify route prices

![TollRoadApp_v1-0-0_Operator](screenshots/TollRoad_Operator.png)

### Vehicle/driver
- can create a secret locally
- can enter the toll road with an entry fee
- can inspect its history

![TollRoadApp_v1-0-0_Vehicle](screenshots/TollRoad_Vehicle.png)

### Booth
- can report a vehicles exit
- can inspect pending and normal exits

![TollRoadApp_v1-0-0_Booth](screenshots/TollRoad_Booth.png)

## Credits
- TollRoad icon designed by Smashicons from Flaticon
- Wouldn't have made it without the brilliant docs from chakra-ui/chakra-ui (@chakra-ui/react)
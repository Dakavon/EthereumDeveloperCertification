import React, { useContext, useState, useEffect } from "react";
import { Heading, Divider, Box, Stack, FormControl, FormLabel, Input, InputGroup, InputLeftAddon, Button } from '@chakra-ui/react';

import { Web3Context } from "../ContextProvider/ContextProvider";
import { OperatorContext } from "./OperatorContextProvider";


export default function TollBoothOperator(){

    const {web3, account}                           = useContext(Web3Context);
    const { operator, operatorAddress,
            toggleReloading, setToggleReloading}    = useContext(OperatorContext);

    const [appVariables, setAppVariables] = useState({
        addTollBooth: {
            tollBoothAddress: "",
        },
        setRoutePrice: {
            entryBooth: "",
            exitBooth: "",
            priceWeis: "",
        },
        setMultiplier: {
            vehicleType: "",
            multiplier: "",
        },
        information: {
            contractBalance: "N/A",
            collectedFees: "N/A",
            isPaused: "N/A",
        }
    });


    useEffect(() => {
        (async () => {
            if(operatorAddress && operator._address){
                try{
                    const _contractBalance = await web3.eth.getBalance(operatorAddress);
                    const operatorOwner = await operator.methods.getOwner().call();
                    const _collectedFees = await operator.methods.getPayment(operatorOwner).call();
                    const _isPaused = await operator.methods.isPaused().call();

                    setAppVariables(_variables => ({
                        ..._variables,
                        information: {
                            ..._variables.information,
                            contractBalance: _contractBalance,
                            collectedFees: _collectedFees,
                            isPaused: _isPaused.toString(10),
                        }
                    }));
                }
                catch(error){}
            }
        })();
    }, [operator, toggleReloading]);


    async function addTollBooth(_tollBooth){
        try{
            _tollBooth = _tollBooth.replace(/\s+/g, '');

            if(operatorAddress){
                const operatorOwner = await operator.methods.getOwner().call();

                if(account == operatorOwner){

                    console.log("sender:", account);
                    console.log("tollBooth: ", _tollBooth);

                    if(web3.utils.isAddress(_tollBooth) && web3.utils.toBN(_tollBooth) != 0){
                        if(!await operator.methods.isTollBooth(_tollBooth).call()){
                            const returned = await operator.methods.addTollBooth(_tollBooth).call({from: account});
                            if(returned){
                                await operator.methods.addTollBooth(_tollBooth)
                                .send({
                                    from: account
                                })
                                .on('transactionHash', (hash) => {
                                    console.log("transactionHash: ", hash);
                                })
                                .on('receipt', (receipt) => {
                                    console.log("receipt :", receipt);
                                })
                                .on('error', (error, receipt) => {
                                    console.log("receipt: ", receipt);
                                    console.error("error message: ", error);
                                });
                                console.log("addTollBooth: successful");
                            }
                            else{
                                console.error("addTollBooth: failed");
                            }
                        }
                        else{
                            console.log("addTollBooth: Argument is already a toll booth");
                        }
                    }
                    else{
                        console.log("addTollBooth: Inputs are incorrect");
                    }
                }
                else{
                    console.log("addTollBooth: Your are not the operator owner");
                }
            }
            else{
                console.log("addTollBooth: You need to select an operator first");
            }
        }
        catch(error){
            console.error(error);
        }
    };


    async function setRoutePrice(_entryBooth, _exitBooth, _priceWeis){
        try{
            _entryBooth = _entryBooth.replace(/\s+/g, '');
            _exitBooth = _exitBooth.replace(/\s+/g, '');

            if(operatorAddress){
                const operatorOwner = await operator.methods.getOwner().call();

                if(account == operatorOwner){

                    console.log("sender:", account);
                    console.log("entryBooth: ", _entryBooth);
                    console.log("exitBooth: ", _exitBooth);
                    console.log("priceWeis: ", _priceWeis);

                    if( web3.utils.isAddress(_entryBooth) && web3.utils.toBN(_entryBooth) != 0
                            &&
                        web3.utils.isAddress(_exitBooth) && web3.utils.toBN(_exitBooth) != 0
                            &&
                        _entryBooth != _exitBooth
                    ){
                        if(await operator.methods.isTollBooth(_entryBooth).call() && await operator.methods.isTollBooth(_exitBooth).call()){
                            const oldRoutePrice = await operator.methods.getRoutePrice(_entryBooth, _exitBooth).call();
                            if(oldRoutePrice != _priceWeis){
                                const returned = await operator.methods.setRoutePrice(_entryBooth, _exitBooth, _priceWeis).call({from: account});
                                if(returned){
                                    await operator.methods.setRoutePrice(_entryBooth, _exitBooth, _priceWeis)
                                    .send({
                                        from: account,
                                        gas: 500000,
                                    })
                                    .on('transactionHash', (hash) => {
                                        console.log("transactionHash: ", hash);
                                    })
                                    .on('receipt', (receipt) => {
                                        console.log("receipt :", receipt);
                                        setToggleReloading(!toggleReloading);
                                    })
                                    .on('error', (error, receipt) => {
                                        console.log("receipt: ", receipt);
                                        console.error("error message: ", error);
                                    });
                                    console.log("setRoutePrice: successful");
                                }
                                else{
                                    console.error("setRoutePrice: failed");
                                }
                            }
                            else{
                                console.log("setRoutePrice: There is no change in price");
                            }
                        }
                        else{
                            console.log("setRoutePrice: One of the booths is not a registered booth");
                        }
                    }
                    else{
                        console.log("setRoutePrice: Inputs are incorrect");
                    }
                }
                else{
                    console.log("setRoutePrice: Your are not the operator owner");
                }
            }
            else{
                console.log("setRoutePrice: You need to select an operator first");
            }
        }
        catch(error){
            console.error(error);
        }
    };


    async function setMultiplier(_vehicleType, _multiplier){
        try{
            if(operatorAddress){
                const operatorOwner = await operator.methods.getOwner().call();

                if(account == operatorOwner){

                    console.log("sender:", account);
                    console.log("vehicleType: ", _vehicleType);
                    console.log("multiplier: ", _multiplier);

                    if(_vehicleType > 0){
                        if(await operator.methods.getMultiplier(_vehicleType).call() != _multiplier){
                            const returned = await operator.methods.setMultiplier(_vehicleType, _multiplier).call({from: account});
                            if(returned){
                                await operator.methods.setMultiplier(_vehicleType, _multiplier)
                                    .send({
                                        from: account
                                    })
                                    .on('transactionHash', (hash) => {
                                        console.log("transactionHash: ", hash);
                                    })
                                    .on('receipt', (receipt) => {
                                        console.log("receipt :", receipt);
                                    })
                                    .on('error', (error, receipt) => {
                                        console.log("receipt: ", receipt);
                                        console.error("error message: ", error);
                                    });
                                    console.log("setMultiplier: successful");
                            }
                            else{
                                console.error("setMultiplier: failed");
                            }
                        }
                        else{
                            console.log("setMultiplier: Same multiplier is already set to the vehicle type");
                        }
                    }
                    else{
                        console.log("setMultiplier: Inputs are incorrect");
                    }
                }
                else{
                    console.log("setMultiplier: Your are not the operator owner");
                }
            }
            else{
                console.log("setMultiplier: You need to select an operator first");
            }
        }
        catch(error){
            console.error(error);
        }
    }


    async function togglePausedState(){
        try{
            if(operatorAddress){
                const operatorOwner = await operator.methods.getOwner().call();

                if(account == operatorOwner){

                    const pausedState = await operator.methods.isPaused().call();

                    const returned = await operator.methods.setPaused(!pausedState).call({from: account});
                    if(returned){
                        await operator.methods.setPaused(!pausedState)
                        .send({
                            from: account
                        })
                        .on('transactionHash', (hash) => {
                            console.log("transactionHash: ", hash);
                        })
                        .on('receipt', (receipt) => {
                            console.log("receipt :", receipt);
                            setToggleReloading(!toggleReloading);
                        })
                        .on('error', (error, receipt) => {
                            console.log("receipt: ", receipt);
                            console.error("error message: ", error);
                        });
                        console.log("togglePausedState: successful");
                    }
                    else{
                        console.error("togglePausedState: failed");
                    }
                }
                else{
                    console.log("togglePausedState: Your are not the operator owner");
                }
            }
            else{
                console.log("togglePausedState: You need to select an operator first");
            }
        }
        catch(error){
            console.error(error);
        }
    }


    return(
        <div>
            <Heading size="lg" m="5px" fontWeight="300">TollBoothOperator</Heading>
            <Divider />
            <Heading size="md" m="5px" fontWeight="300">Contract information</Heading>
            <Box w="90%" p={3}>
                {   operatorAddress ?
                    <div>
                        Contract paused state: {appVariables.information.isPaused}
                        <br />
                        Contract balance: {appVariables.information.contractBalance} Wei Ξ
                        <br />
                        Collected fees: {appVariables.information.collectedFees} Wei Ξ
                    </div>
                    :
                    <div>N/A</div>
                }
            </Box>
            <Divider />
            <Heading size="md" m="5px" fontWeight="300">Toggle paused state</Heading>
            <Box w="90%" p={3}>
                <form>
                <Button colorScheme="yellow" variant="solid" fontWeight="300" size="sm"
                        onClick={() => togglePausedState()}>
                        toggle paused state
                    </Button>
                </form>
            </Box>
            <Divider />
            <Heading size="md" m="5px" fontWeight="300">Add toll booths</Heading>
            <Box w="90%" p={3}>
                <form>
                <Stack direction="column" spacing="10px">
                    <FormControl id="tollBoothAddress" isRequired>
                        <FormLabel>toll booth</FormLabel>
                        <Input variant="filled" size="sm" type="text"
                            placeholder="address"
                            value={appVariables.addTollBooth.tollBoothAddress}
                            onChange={event => setAppVariables({
                                ...appVariables,
                                addTollBooth: {
                                    ...appVariables.addTollBooth,
                                    tollBoothAddress: event.target.value,
                                }
                            })}
                        />
                    </FormControl>
                    <br />
                    <Button colorScheme="green" variant="solid" fontWeight="300" size="sm"
                        onClick={() =>
                            addTollBooth(
                                appVariables.addTollBooth.tollBoothAddress
                            )}>
                        addTollBooth
                    </Button>
                </Stack>
                </form>
            </Box>
            <Divider />
            <Heading size="md" m="5px" fontWeight="300">Add base route prices</Heading>
            <Box w="90%" p={3}>
                <form>
                <Stack direction="column" spacing="10px">
                    <FormControl id="entryBooth" isRequired>
                        <FormLabel>entryBooth</FormLabel>
                        <Input variant="filled" size="sm" type="text"
                            placeholder="address"
                            value={appVariables.setRoutePrice.entryBooth}
                            onChange={event => setAppVariables({
                                ...appVariables,
                                setRoutePrice: {
                                    ...appVariables.setRoutePrice,
                                    entryBooth: event.target.value,
                                }
                            })}
                        />
                    </FormControl>
                    <FormControl id="exitBooth" isRequired>
                        <FormLabel>exitBooth</FormLabel>
                        <Input variant="filled" size="sm" type="text"
                            placeholder="address"
                            value={appVariables.setRoutePrice.exitBooth}
                            onChange={event => setAppVariables({
                                ...appVariables,
                                setRoutePrice: {
                                    ...appVariables.setRoutePrice,
                                    exitBooth: event.target.value,
                                }
                            })}
                        />
                    </FormControl>
                    <FormControl id="priceWeis" isRequired>
                        <FormLabel>priceWeis</FormLabel>
                        <InputGroup>
                            <InputLeftAddon h="2em" pointerEvents="none" children="Wei Ξ" />
                            <Input variant="filled" size="sm" type="text"
                                placeholder="uint"
                                value={appVariables.setRoutePrice.priceWeis}
                                onChange={event => setAppVariables({
                                    ...appVariables,
                                    setRoutePrice: {
                                        ...appVariables.setRoutePrice,
                                        priceWeis: event.target.value,
                                    }
                                })}
                            />
                        </InputGroup>
                    </FormControl>
                    <br />
                    <Button colorScheme="green" variant="solid" fontWeight="300" size="sm"
                        onClick={() =>
                            setRoutePrice(
                                appVariables.setRoutePrice.entryBooth,
                                appVariables.setRoutePrice.exitBooth,
                                appVariables.setRoutePrice.priceWeis
                            )}>
                        setRoutePrice
                    </Button>
                </Stack>
                </form>
            </Box>
            <Divider />
            <Heading size="md" m="5px" fontWeight="300">Set multiplier</Heading>
            <Box w="90%" p={3}>
                <form>
                <Stack direction="column" spacing="10px">
                    <FormControl id="operator-vehicleType" isRequired>
                        <FormLabel>vehicleType</FormLabel>
                        <Input variant="filled" size="sm" type="text"
                            placeholder="uint"
                            value={appVariables.setMultiplier.vehicleType}
                            onChange={event => setAppVariables({
                                ...appVariables,
                                setMultiplier: {
                                    ...appVariables.setMultiplier,
                                    vehicleType: event.target.value,
                                }
                            })}
                        />
                    </FormControl>
                    <FormControl id="multiplier" isRequired>
                        <FormLabel>multiplier</FormLabel>
                        <Input variant="filled" size="sm" type="text"
                            placeholder="uint"
                            value={appVariables.setMultiplier.multiplier}
                            onChange={event => setAppVariables({
                                ...appVariables,
                                setMultiplier: {
                                    ...appVariables.setMultiplier,
                                    multiplier: event.target.value,
                                }
                            })}
                        />
                    </FormControl>
                    <br />
                    <Button colorScheme="green" variant="solid" fontWeight="300" size="sm"
                        onClick={() =>
                            setMultiplier(
                                appVariables.setMultiplier.vehicleType,
                                appVariables.setMultiplier.multiplier
                            )}>
                        setMultiplier
                    </Button>
                </Stack>
                </form>
            </Box>
        </div>
    );

}
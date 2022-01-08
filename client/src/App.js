import React, { useContext } from "react";
import { Tabs, TabList, TabPanels, Tab, TabPanel, Container, Box } from '@chakra-ui/react';
import './App.css';
import { Web3Context } from "./components/ContextProvider/ContextProvider";


import Regulator from "./components/Regulator/Regulator";
import TollBoothOperator from "./components/TollBoothOperator/TollBoothOperator";
import Vehicle from "./components/Vehicle/Vehicle";
import TollBooth from "./components/TollBooth/TollBooth";


export default function App() {

    const {web3} = useContext(Web3Context);

    if(!web3){
        return(
            <div className="errorMessage">
                Please connect to web3.
            </div>
        );
    }
    else{
        return (
            <div className="App">
                <Tabs isFitted>
                    <TabList>
                        <Tab>Regulator</Tab>
                        <Tab>TollBoothOperator</Tab>
                        <Tab>Vehicle</Tab>
                        <Tab>TollBooth</Tab>
                    </TabList>

                    <Container bg="gray.300" width="800px" maxW="80%" boxShadow="lg" rounded="md" mt="10px">
                        <Box className="wrapper">
                            <TabPanels>
                                <TabPanel><Regulator /></TabPanel>
                                <TabPanel><TollBoothOperator /></TabPanel>
                                <TabPanel><Vehicle /></TabPanel>
                                <TabPanel><TollBooth /></TabPanel>
                            </TabPanels>
                        </Box>
                    </Container>
                </Tabs>
            </div>
        );
    }
}